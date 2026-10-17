import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  CreateFormUseCase,
  DeleteFormUseCase,
  ListContactSubmissionsUseCase,
  ListFormSubmissionsUseCase,
  ListFormsUseCase,
  UpdateFormUseCase,
} from '../application/use-cases/forms.use-cases';
import type { Form } from '../domain/form.entity';
import type { FormSubmission } from '../domain/submission';

const idParam = new ZodValidationPipe(z.uuid());
const text = z.string().max(2000);

const createSchema = z.object({
  name: text,
  kind: z.string().max(20),
  campaign: text.nullable().default(null),
  successUrl: text.nullable().default(null),
});
const updateSchema = z.object({
  name: text.optional(),
  campaign: text.nullable().optional(),
  successUrl: text.nullable().optional(),
  active: z.boolean().optional(),
  /** Gera chave nova: o HTML publicado com a antiga para de funcionar. */
  rotateKey: z.boolean().optional(),
});
const contactQuery = z.object({ contactId: z.uuid() });

const presentForm = (form: Form, submissions?: number) => ({
  id: form.id,
  name: form.name,
  kind: form.kind,
  publicKey: form.publicKey,
  campaign: form.campaign,
  successUrl: form.successUrl,
  active: form.active,
  createdAt: form.createdAt.toISOString(),
  ...(submissions !== undefined && { submissions }),
});

const presentSubmission = (s: FormSubmission) => ({
  id: s.id,
  formId: s.formId,
  contactId: s.contactId,
  name: s.name,
  phone: s.phone,
  email: s.email,
  message: s.message,
  serviceId: s.serviceId,
  serviceName: s.serviceName,
  preferredDate: s.preferredDate,
  createdAt: s.createdAt.toISOString(),
});

/**
 * Formulários do site (`forms:manage`, Admin por padrão). Os envios de um
 * contato (ficha) só pedem `contacts:view`.
 */
@Controller('v1/forms')
export class FormsController {
  constructor(
    private readonly listForms: ListFormsUseCase,
    private readonly createForm: CreateFormUseCase,
    private readonly updateForm: UpdateFormUseCase,
    private readonly deleteForm: DeleteFormUseCase,
    private readonly listSubmissions: ListFormSubmissionsUseCase,
    private readonly contactSubmissions: ListContactSubmissionsUseCase,
  ) {}

  @RequirePermissions('contacts:view')
  @Get('submissions')
  async byContact(@Query(new ZodValidationPipe(contactQuery)) query: z.infer<typeof contactQuery>) {
    return (await this.contactSubmissions.execute(query.contactId)).map(
      ({ submission, formName }) => ({ ...presentSubmission(submission), formName }),
    );
  }

  @RequirePermissions('forms:manage')
  @Get()
  async list() {
    return (await this.listForms.execute()).map(({ form, submissions }) =>
      presentForm(form, submissions),
    );
  }

  @RequirePermissions('forms:manage')
  @Post()
  async create(@Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return presentForm(await this.createForm.execute(body));
  }

  @RequirePermissions('forms:manage')
  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    return presentForm(await this.updateForm.execute(id, body));
  }

  @RequirePermissions('forms:manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deleteForm.execute(id);
  }

  @RequirePermissions('forms:manage')
  @Get(':id/submissions')
  async submissions(@Param('id', idParam) id: string) {
    return (await this.listSubmissions.execute(id)).map(presentSubmission);
  }
}
