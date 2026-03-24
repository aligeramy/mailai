import type { EmailChain, EmailMessage, EmailProvider } from "@/lib/types";

const MAILAI_REPLY_ATTR = 'data-mailai-reply="1"';
const MAILAI_TEXT_START = "[[MAILAI_REPLY_START]]";
const MAILAI_TEXT_END = "[[MAILAI_REPLY_END]]";

/**
 * Outlook email provider using Office.js API.
 * Reads email chain from the current Outlook item and inserts replies.
 */
export class OutlookProvider implements EmailProvider {
  private readonly office: typeof Office | null;

  constructor(officeInstance?: typeof Office) {
    this.office =
      officeInstance ?? (typeof Office !== "undefined" ? Office : null);
  }

  private getMailbox(): Office.Mailbox {
    if (!this.office?.context?.mailbox) {
      throw new Error(
        "Office.js mailbox not available. Ensure the add-in is running in Outlook."
      );
    }
    return this.office.context.mailbox;
  }

  private getItem(): Office.MessageRead | Office.MessageCompose {
    const item = this.getMailbox().item;
    if (!item) {
      throw new Error("No mail item is currently selected.");
    }
    return item as Office.MessageRead | Office.MessageCompose;
  }

  isComposeMode(): boolean {
    const item = this.getItem();
    return typeof (item as Office.MessageRead).subject !== "string";
  }

  getCurrentUserEmail(): Promise<string> {
    const mailbox = this.getMailbox();
    return Promise.resolve(
      mailbox.userProfile?.emailAddress ?? "user@example.com"
    );
  }

  async getEmailChain(): Promise<EmailChain> {
    const item = this.getItem();
    const currentUserEmail = await this.getCurrentUserEmail();

    if (this.isComposeMode()) {
      return this.getComposeChain(
        item as Office.MessageCompose,
        currentUserEmail
      );
    }

    return this.getReadChain(item as Office.MessageRead, currentUserEmail);
  }

  private async getReadChain(
    item: Office.MessageRead,
    currentUserEmail: string
  ): Promise<EmailChain> {
    const body = await this.getBodyAsync(item);
    const subject =
      typeof item.subject === "string" ? item.subject : "No Subject";

    const from = item.from?.emailAddress ?? "unknown@example.com";
    const to = (item.to ?? []).map(
      (r: Office.EmailAddressDetails) => r.emailAddress
    );
    const cc = (item.cc ?? []).map(
      (r: Office.EmailAddressDetails) => r.emailAddress
    );

    const currentMessage: EmailMessage = {
      id: item.itemId ?? "current",
      from,
      to,
      cc,
      subject,
      body,
      timestamp: item.dateTimeCreated
        ? new Date(item.dateTimeCreated.toString())
        : new Date(),
      isHtml: true,
    };

    return {
      messages: [currentMessage],
      subject,
      currentUserEmail,
    };
  }

  private async getComposeChain(
    item: Office.MessageCompose,
    currentUserEmail: string
  ): Promise<EmailChain> {
    const body = await this.getComposeBodyAsync(item);

    const subject = await new Promise<string>((resolve) => {
      item.subject.getAsync((result) => {
        resolve(
          result.status === Office.AsyncResultStatus.Succeeded
            ? (result.value ?? "No Subject")
            : "No Subject"
        );
      });
    });

    const fromAddr = await this.getComposeFromAddressAsync(item);

    return {
      messages: [
        {
          id: "compose-draft",
          from: fromAddr,
          to: [currentUserEmail],
          subject,
          body,
          timestamp: new Date(),
          isHtml: true,
        },
      ],
      subject,
      currentUserEmail,
    };
  }

  private getBodyAsync(item: Office.MessageRead): Promise<string> {
    return new Promise((resolve, reject) => {
      item.body.getAsync(Office.CoercionType.Html, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value);
        } else {
          reject(
            new Error(`Failed to get email body: ${result.error?.message}`)
          );
        }
      });
    });
  }

  private getComposeFromAddressAsync(
    item: Office.MessageCompose
  ): Promise<string> {
    return new Promise((resolve) => {
      item.from.getAsync((result) => {
        if (
          result.status === Office.AsyncResultStatus.Succeeded &&
          result.value?.emailAddress
        ) {
          resolve(result.value.emailAddress);
        } else {
          resolve("unknown@sender");
        }
      });
    });
  }

  private getComposeBodyAsync(item: Office.MessageCompose): Promise<string> {
    return new Promise((resolve, reject) => {
      item.body.getAsync(Office.CoercionType.Html, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value);
        } else {
          reject(
            new Error(`Failed to get compose body: ${result.error?.message}`)
          );
        }
      });
    });
  }

  async insertReply(text: string): Promise<void> {
    const item = this.getItem();

    if (this.isComposeMode()) {
      await this.insertIntoCompose(item as Office.MessageCompose, text);
    } else {
      // In read mode, we need to create a reply first
      await this.insertIntoReadReply(text);
    }
  }

  private async insertIntoCompose(
    item: Office.MessageCompose,
    text: string
  ): Promise<void> {
    const getBody = (
      coercionType: Office.CoercionType.Html | Office.CoercionType.Text
    ): Promise<string> =>
      new Promise((resolve, reject) => {
        item.body.getAsync(coercionType, (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            resolve(result.value ?? "");
          } else {
            reject(
              new Error(`Failed to read draft body: ${result.error?.message}`)
            );
          }
        });
      });

    const setBody = (
      value: string,
      coercionType: Office.CoercionType.Html | Office.CoercionType.Text
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        item.body.setAsync(value, { coercionType }, (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            resolve();
          } else {
            reject(
              new Error(`Failed to set draft body: ${result.error?.message}`)
            );
          }
        });
      });

    const getBodyType = (): Promise<Office.CoercionType> =>
      new Promise((resolve, reject) => {
        item.body.getTypeAsync((result) => {
          if (
            result.status === Office.AsyncResultStatus.Succeeded &&
            result.value
          ) {
            resolve(result.value);
          } else {
            reject(
              new Error(`Failed to get body type: ${result.error?.message}`)
            );
          }
        });
      });

    const bodyType = await getBodyType();
    const isHtmlBody = bodyType === Office.CoercionType.Html;

    const escaped = text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const htmlReply = escaped.replaceAll("\n", "<br>");
    const wrapped = `<div ${MAILAI_REPLY_ATTR}>${htmlReply}</div>`;
    const wrappedText = `${MAILAI_TEXT_START}\n${text}\n${MAILAI_TEXT_END}`;

    if (isHtmlBody) {
      const current = await getBody(Office.CoercionType.Html);
      const blockPattern =
        /<div[^>]*data-mailai-reply=(["'])1\1[^>]*>[\s\S]*?<\/div>/gi;

      const hasExistingBlock = blockPattern.test(current);
      blockPattern.lastIndex = 0;
      // Only replace our own wrapper, or prepend above the full body. Do not slice by
      // “thread markers” — that rewrites part of the quoted chain and can delete messages.
      const next = hasExistingBlock
        ? current.replace(blockPattern, wrapped)
        : `${wrapped}<br><br>${current}`;

      await setBody(next, Office.CoercionType.Html);
      return;
    }

    const currentText = await getBody(Office.CoercionType.Text);
    const textBlockPattern =
      /\[\[MAILAI_REPLY_START\]\][\s\S]*?\[\[MAILAI_REPLY_END\]\]\n?/gi;
    const hasTextBlock = textBlockPattern.test(currentText);
    textBlockPattern.lastIndex = 0;
    const nextText = hasTextBlock
      ? currentText.replace(textBlockPattern, `${wrappedText}\n`)
      : `${wrappedText}\n\n${currentText}`;

    await setBody(nextText, Office.CoercionType.Text);
  }

  private insertIntoReadReply(text: string): Promise<void> {
    const item = this.getItem() as Office.MessageRead;

    return new Promise((resolve, reject) => {
      if (item.displayReplyForm) {
        item.displayReplyForm(text);
        resolve();
      } else {
        reject(new Error("Reply form not available in this context"));
      }
    });
  }
}
