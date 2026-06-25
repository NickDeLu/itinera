import { Command } from "./Command";
import { EmailRepository } from "../repositories/EmailRepository";

export class SaveEmailDataCommand implements Command {
  constructor(
    private userId: string,
    private senderEmail?: string,
    private recipientEmail?: string,
    private subject?: string,
    private body?: string,
    private receivedAt?: string,
    private tripId?: string
  ) {}

  async execute(): Promise<any> {
    const emailMessage = await EmailRepository.saveEmailMessage(
      this.userId,
      this.senderEmail,
      this.recipientEmail,
      this.subject,
      this.body,
      this.receivedAt,
      this.tripId
    );

    return {
      success: true,
      message: `Email saved successfully`,
      id: emailMessage.id,
      email: emailMessage,
    };
  }
}
