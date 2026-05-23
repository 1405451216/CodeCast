import { Attachment } from './types';
import type { SliceSet } from './storeTypes';

interface AttachmentSlice {
  attachments: Attachment[];
  setAttachments: (attachments: Attachment[]) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
}

const createAttachmentSlice = (set: SliceSet): AttachmentSlice => ({
  attachments: [],
  setAttachments: (attachments) => set({ attachments }),
  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...(state.attachments as Attachment[]), attachment] })),
  removeAttachment: (index) =>
    set((state) => ({
      attachments: (state.attachments as Attachment[]).filter((_, i) => i !== index),
    })),
  clearAttachments: () => set({ attachments: [] }),
});

export { type AttachmentSlice, createAttachmentSlice };
