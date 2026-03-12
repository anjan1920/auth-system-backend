import Mailgen from "mailgen";
import nodemailer from "nodemailer";

// create transporter once
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

const sendEmail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Authentication & Authorization",
      link: "****",
    },
  });

  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  try {

    const mail = {
      from: '"Authentication System" <anjandas8427@gmail.com>',
      to: options.email,
      subject: options.subject,
      text: emailTextual,
      html: emailHtml,
    };

    const info = await transporter.sendMail(mail);

    console.log("Email sent:", info.messageId);

  } catch (error) {
    console.error("Email sending failed:", error);
  }
};