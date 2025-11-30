// This DTO is used for file upload metadata
// The actual file will be handled by multer
export class CreateAttachmentDto {
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  filePath: string;
}


