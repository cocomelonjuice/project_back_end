export type ChatLocale = 'en' | 'vi';

export type ChatAssistantStrings = {
  confirmHint: string;
  invalidJson: string;
  unavailable: string;
  unavailableRateLimit: string;
  unavailableConfig: string;
  cancelled: string;
  confirmInvalid: string;
  actionFailed: string;
  genericActionError: string;
};

const M = {
  en: {
    confirmHint:
      '\n\nReply **YES** to confirm or **NO** to cancel.',
    invalidJson:
      'I could not read a valid action from the model. Please rephrase briefly and try again.',
    unavailable:
      'The assistant is temporarily unavailable. Please try again in a moment.',
    unavailableRateLimit:
      'The AI service is rate-limited right now. Please wait a short time and try again.',
    unavailableConfig:
      'The AI assistant is not configured or cannot reach the provider. Check GROQ_API_KEY and network, then try again.',
    cancelled: 'Action cancelled. What would you like to do next?',
    confirmInvalid:
      'That confirmation was invalid or expired. Please start the request again.',
    actionFailed:
      'That action could not be completed. Check IDs, permissions, and try again.',
    genericActionError:
      'Something went wrong while running that action. Check IDs and permissions.',
    issueCreated: 'Created issue: {summary}.',
  },
  vi: {
    confirmHint:
      '\n\nTrả lời **YES** để xác nhận hoặc **NO** để hủy.',
    invalidJson:
      'Không đọc được lệnh hợp lệ từ mô hình. Vui lòng diễn đạt ngắn gọn và thử lại.',
    unavailable:
      'Trợ lý tạm thời không khả dụng. Vui lòng thử lại sau.',
    unavailableRateLimit:
      'Dịch vụ AI đang bị giới hạn tần suất. Vui lòng đợi một lát rồi thử lại.',
    unavailableConfig:
      'Trợ lý AI chưa được cấu hình hoặc không kết nối được nhà cung cấp. Kiểm tra GROQ_API_KEY và mạng, rồi thử lại.',
    cancelled: 'Đã hủy thao tác. Bạn muốn làm gì tiếp theo?',
    confirmInvalid:
      'Xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng gửi yêu cầu lại từ đầu.',
    actionFailed:
      'Không thực hiện được thao tác. Kiểm tra ID và quyền rồi thử lại.',
    genericActionError:
      'Đã xảy ra lỗi khi chạy thao tác. Kiểm tra ID và quyền.',
  },
} as const;

export function chatAssistantMessages(locale: ChatLocale): ChatAssistantStrings {
  return locale === 'vi' ? M.vi : M.en;
}

export function pickChatLocale(acceptLanguage?: string): ChatLocale {
  if (!acceptLanguage?.trim()) return 'en';
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('vi')) return 'vi';
  return 'en';
}
