export const sendTextEmail = (
  targetEmail: string,
  title: string,
  body: string
) => {
  GmailApp.sendEmail(targetEmail, title, body);
};

export const sendHTMLEmail = (
  templateName: string,
  contents: any,
  targetEmail: string,
  title: string,
  body
) => {
  console.log('contents', contents);
  const htmlTemplate = HtmlService.createTemplateFromFile(templateName);
  for (const key in contents) {
    htmlTemplate[key] = contents[key] || '';
  }
  const htmlBody = htmlTemplate.evaluate().getContent();
  const options = {
    htmlBody,
  };
  GmailApp.sendEmail(targetEmail, title, body, options);
};
