import 'dotenv/config';
import { sendWelcomeEmail } from './src/lib/ses-email.js';

const to = process.argv[2] ?? process.env.SES_FROM_EMAIL!;

console.log(`Sending welcome email to: ${to}`);

try {
  await sendWelcomeEmail(to, 'Hiep Test');
  console.log('Email sent successfully!');
} catch (err) {
  console.error('Failed:', err);
  process.exit(1);
}
