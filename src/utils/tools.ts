import { useStore } from '../store/useStore';

export const agentTools = {
  read_uploaded_file: (filename: string): string => {
    const { uploadedFiles } = useStore.getState();
    // try exact match first, then partial match
    let file = uploadedFiles.find(f => f.name.toLowerCase() === filename.toLowerCase());
    
    if (!file) {
      file = uploadedFiles.find(f => f.name.toLowerCase().includes(filename.toLowerCase()) || filename.toLowerCase().includes(f.name.toLowerCase()));
    }

    if (file) {
      return file.content;
    }
    return `[System Error: File '${filename}' not found in uploaded files.]`;
  }
};
