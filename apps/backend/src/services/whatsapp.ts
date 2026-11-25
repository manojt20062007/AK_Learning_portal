/**
 * Builds a pre-typed WhatsApp invitation message and wa.me deep link
 * so the admin can manually send the invite from the site with one click.
 */
export function buildWhatsAppInvite(params: {
  phone: string;
  studentName: string;
  studentId: string;
  email: string;
  setupLink: string;
  courseTitle?: string;
}): { whatsappMessage: string; whatsappUrl: string } {
  const { phone, studentName, studentId, email, setupLink, courseTitle } = params;

  const cleanDigits = phone.replace(/\D/g, '');
  const intlPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

  const lines = [
    `Hello ${studentName}, welcome to *AK Learning*!`,
    ``,
    `Your student account has been created.`,
    `*Student ID:* ${studentId}`,
    `*Login Email:* ${email}`,
    ...(courseTitle ? [`*Enrolled Course:* ${courseTitle}`] : []),
    ``,
    `Please set your password using this one-time link (valid for 7 days):`,
    setupLink,
    ``,
    `After setting your password, you can log in anytime to start learning.`,
  ];

  const whatsappMessage = lines.join('\n');
  const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  return { whatsappMessage, whatsappUrl };
}
