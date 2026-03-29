export type ChatLocale = 'en' | 'vi';

const M = {
  en: {
    confirmHint:
      '\n\nReply **YES** to confirm or **NO** to cancel.',
    invalidJson:
      'I could not read a valid action from the model. Please rephrase briefly and try again.',
    unavailable:
      'The assistant is temporarily unavailable. Please try again in a moment.',
    cancelled: 'Action cancelled. What would you like to do next?',
    confirmInvalid:
      'That confirmation was invalid or expired. Please start the request again.',
    actionFailed:
      'That action could not be completed. Check IDs, permissions, and try again.',
    genericActionError:
      'Something went wrong while running that action. Check IDs and permissions.',
  },
  vi: {
    confirmHint:
      '\n\nTrả lời **YES** để xác nhận hoặc **NO** để hủy.',
    invalidJson:
      'Không đọc được lệnh hợp lệ từ mô hình. Vui lòng diễn đạt ngắn gọn và thử lại.',
    unavailable:
      'Trợ lý tạm thời không khả dụng. Vui lòng thử lại sau.',
    cancelled: 'Đã hủy thao tác. Bạn muốn làm gì tiếp theo?',
    confirmInvalid:
      'Xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng gửi yêu cầu lại từ đầu.',
    actionFailed:
      'Không thực hiện được thao tác. Kiểm tra ID và quyền rồi thử lại.',
    genericActionError:
      'Đã xảy ra lỗi khi chạy thao tác. Kiểm tra ID và quyền.',
  },
} as const;

export function chatAssistantMessages(locale: ChatLocale) {
  return locale === 'vi' ? M.vi : M.en;
}

export function pickChatLocale(acceptLanguage?: string): ChatLocale {
  if (!acceptLanguage?.trim()) return 'en';
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('vi')) return 'vi';
  return 'en';
}
