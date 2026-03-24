/** Represents a single message in an email conversation */
export interface EmailMessage {
  body: string;
  cc?: string[];
  from: string;
  id: string;
  isHtml?: boolean;
  subject: string;
  timestamp: Date;
  to: string[];
}

/** The full email chain/conversation context */
export interface EmailChain {
  currentUserEmail: string;
  messages: EmailMessage[];
  subject: string;
}

/** Tone options for reply generation */
export type ReplyTone =
  | "professional"
  | "friendly"
  | "concise"
  | "formal"
  | "casual";

/** Length options for reply generation */
export type ReplyLength = "quick" | "short" | "normal" | "long";

/** Options for generating a reply */
export interface GenerateReplyOptions {
  additionalContext?: string;
  emailChain: EmailChain;
  length?: ReplyLength;
  maxTokens?: number;
  tone: ReplyTone;
}

/** Result from reply generation */
export interface GenerateReplyResult {
  model: string;
  reply: string;
  tokensUsed: number;
}

/** Abstracted email provider interface - enables Gmail, Outlook, etc. */
export interface EmailProvider {
  /** Get the current user's email address */
  getCurrentUserEmail(): Promise<string>;
  /** Get the current email chain from the email client */
  getEmailChain(): Promise<EmailChain>;
  /** Insert generated reply text into the compose window */
  insertReply(text: string): Promise<void>;
  /** Check if we're in compose mode vs read mode */
  isComposeMode(): boolean;
}

/** AI service interface - enables OpenAI, Anthropic, etc. */
export interface AIService {
  generateReply(options: GenerateReplyOptions): Promise<GenerateReplyResult>;
}

/** Configuration for the app */
export interface MailAIConfig {
  defaultTone: ReplyTone;
  model: string;
  openaiApiKey: string;
}
