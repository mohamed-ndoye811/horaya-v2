export {
  type BookingMail,
  bookingAwaitingPaymentEmail,
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingLinkEmail,
  bookingPaymentReceivedEmail,
  bookingPendingEmail,
  bookingPromotedEmail,
  bookingRefundedEmail,
  bookingRefusedEmail,
  bookingReminderEmail,
  bookingWaitlistedEmail,
  teamAlmostFullEmail,
  teamBookingEmail,
  teamReminderEmail,
  weeklyDigestEmail,
} from "./booking-templates";
export { escapeHtml } from "./layout";
export { createConsoleMailer, createSmtpMailer, type EmailContent, type Mailer } from "./mailer";
export { emailVerificationEmail, invitationEmail, passwordResetEmail } from "./templates";
