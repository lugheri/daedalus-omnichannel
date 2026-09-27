/** QR code de pareamento atual do canal, publicado pelo conector (efêmero). */
export interface QrCodeReader {
  read(channelId: string): Promise<string | null>;
}

export const QR_CODE_READER = Symbol('QrCodeReader');
