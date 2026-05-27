import { Attachment, ImageAttachment, ContextReference } from './types';
import type { SliceSet } from './storeTypes';

interface AttachmentSlice {
  attachments: Attachment[];
  images: ImageAttachment[];
  contextReferences: ContextReference[];
  setAttachments: (attachments: Attachment[]) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
  addImage: (image: ImageAttachment) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  addContextRef: (ref: ContextReference) => void;
  removeContextRef: (id: string) => void;
  clearContextRefs: () => void;
}

const createAttachmentSlice = (set: SliceSet): AttachmentSlice => ({
  attachments: [],
  images: [],
  contextReferences: [],
  setAttachments: (attachments) => set({ attachments }),
  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...(state.attachments as Attachment[]), attachment] })),
  removeAttachment: (index) =>
    set((state) => ({
      attachments: (state.attachments as Attachment[]).filter((_, i) => i !== index),
    })),
  clearAttachments: () => set({ attachments: [] }),
  addImage: (image) =>
    set((state) => ({ images: [...(state.images as ImageAttachment[]), image] })),
  removeImage: (id) =>
    set((state) => ({
      images: (state.images as ImageAttachment[]).filter((img) => img.id !== id),
    })),
  clearImages: () => set({ images: [] }),
  addContextRef: (ref) =>
    set((state) => ({ contextReferences: [...(state.contextReferences as ContextReference[]), ref] })),
  removeContextRef: (id) =>
    set((state) => ({
      contextReferences: (state.contextReferences as ContextReference[]).filter((r) => r.id !== id),
    })),
  clearContextRefs: () => set({ contextReferences: [] }),
});

export { type AttachmentSlice, createAttachmentSlice };
