import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { FILE_STORAGE, type FileStorage } from '../../../../../shared/application/file-storage';
import { MediaNotFoundError } from '../../../domain/errors/media-not-found.error';
import { MESSAGE_REPOSITORY, type MessageRepository } from '../../ports/message.repository';
import { VisibleConversations } from '../../visible-conversations';

export interface MediaFile {
  stream: Readable;
  mimeType: string;
  fileName: string | null;
  size: number | null;
}

/**
 * Arquivo de uma mensagem. A cada download confere o escopo do membro sobre
 * a conversa — é por isso que o arquivo passa pela API em vez de um link
 * direto ao armazenamento.
 */
@Injectable()
export class GetMessageMediaUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(input: { conversationId: string; messageId: string }): Promise<MediaFile> {
    const { conversation } = await this.visible.load(input.conversationId);
    const message = await this.messages.findById(input.messageId);
    if (!message?.media || message.conversationId !== conversation.id) {
      throw new MediaNotFoundError();
    }
    const file = await this.storage.open(message.media.key);
    if (!file) throw new MediaNotFoundError();
    return {
      stream: file.stream,
      mimeType: message.media.mimeType,
      fileName: message.media.fileName,
      size: file.size,
    };
  }
}
