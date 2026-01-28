// app/actions.ts
"use server"; // VIGTIGT: Dette gør at koden kun kører på serveren
import nodemailer from "nodemailer";

export async function sendBacklogEmail(article: any, categories: string) {
  
  // 1. Opsætning af "transporter" (forbindelsen til Gmail)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,    // Skift til koden fra Trin 2 (uden mellemrum)
    },
  });
  // YEEEE HAW! BABY YES SIRSKIE!
  // Vi formatterer emnet præcis som på dit billede:
  // "Cell Membranes... /// 01 & 25"  
  const subjectLine = `${article.title} /// ${categories}`;

  const mailOptions = {
    from: `"AMR System" <${process.env.GMAIL_USER}>`,
    to: "backlog@medezide.com", 
    subject: subjectLine,
    // Kroppen af mailen er nu kun linket, præcis som på billedet
    text: article.url, 
    html: `<a href="${article.url}">${article.url}</a>`
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Fejl ved afsendelse af mail:", error);
    return { success: false, error: error };
  }
}