import type {
  CorrespondentContextWindow,
  CorrespondentHistoryProgress,
  EmailChain,
  EmailProvider,
} from "@/lib/types";

/**
 * Gmail email provider stub.
 * This is a placeholder for future Gmail integration via the Gmail API.
 * Implements the same EmailProvider interface used by OutlookProvider.
 */
export class GmailProvider implements EmailProvider {
  getEmailChain(): Promise<EmailChain> {
    return Promise.reject(
      new Error(
        "Gmail provider is not yet implemented. Coming in a future release."
      )
    );
  }

  insertReply(_text: string): Promise<void> {
    return Promise.reject(
      new Error(
        "Gmail provider is not yet implemented. Coming in a future release."
      )
    );
  }

  getCurrentUserEmail(): Promise<string> {
    return Promise.reject(
      new Error(
        "Gmail provider is not yet implemented. Coming in a future release."
      )
    );
  }

  isComposeMode(): boolean {
    return false;
  }

  fetchCorrespondentHistoryForPrompt(
    _window: CorrespondentContextWindow,
    _onProgress?: (progress: CorrespondentHistoryProgress) => void
  ): Promise<string> {
    return Promise.resolve("");
  }
}
