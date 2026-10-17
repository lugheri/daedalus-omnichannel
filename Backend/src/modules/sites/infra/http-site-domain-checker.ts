import { Inject, Injectable, Logger } from '@nestjs/common';
import { request } from 'node:http';
import type { SiteDomainChecker } from '../application/ports/site-domain-checker';
import { SITES_SETTINGS, type SitesSettings } from './sites-settings';

const TIMEOUT_MS = 5_000;
/** O arquivo de verificação é só o id do site. */
const MAX_BYTES = 1_024;

/**
 * Busca o arquivo de verificação pelo próprio domínio, por HTTPS, como um
 * visitante (passando pela Cloudflare e pelo túnel). Sem seguir
 * redirecionamento, com tempo e tamanho limitados; qualquer falha = "não
 * chega". Em dev (\`SITES_DOMAIN_CHECK_VIA\`), conecta direto no nginx dos sites
 * com o Host do domínio — não há DNS para domínio de teste.
 */
@Injectable()
export class HttpSiteDomainChecker implements SiteDomainChecker {
  private readonly logger = new Logger(HttpSiteDomainChecker.name);

  constructor(@Inject(SITES_SETTINGS) private readonly settings: SitesSettings) {}

  async reaches(domain: string, path: string, expected: string): Promise<boolean> {
    try {
      const body = this.settings.domainCheckVia
        ? await this.viaLocal(this.settings.domainCheckVia, domain, path)
        : await this.viaHttps(domain, path);
      return body?.trim() === expected;
    } catch (error) {
      this.logger.debug(`Domínio ${domain} não respondeu: ${String(error)}`);
      return false;
    }
  }

  private async viaHttps(domain: string, path: string): Promise<string | null> {
    const response = await fetch(`https://${domain}/${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status !== 200) return null;
    const text = await response.text();
    return text.length > MAX_BYTES ? null : text;
  }

  private viaLocal(via: string, domain: string, path: string): Promise<string | null> {
    const [host, port] = via.split(':');
    return new Promise((resolve, reject) => {
      const req = request(
        {
          host,
          port: Number(port),
          path: `/${path}`,
          headers: { host: domain },
          timeout: TIMEOUT_MS,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            resolve(null);
            return;
          }
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            text += chunk;
            if (text.length > MAX_BYTES) req.destroy();
          });
          res.on('end', () => resolve(text));
        },
      );
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      req.end();
    });
  }
}
