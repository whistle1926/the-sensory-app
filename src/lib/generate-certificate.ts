interface CertificateData {
  learnerName: string;
  courseTitle: string;
  courseDuration: string;
  completionDate: Date;
}

export function generateCertificateHTML(data: CertificateData): string {
  const formattedDate = data.completionDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificate of Completion — ${escapeHtml(data.courseTitle)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .certificate {
      width: 800px;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background: oklch(0.17 0.015 280);
      color: white;
      padding: 2.5rem 3rem;
      text-align: center;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: oklch(0.637 0.237 25.331);
      border-radius: 12px;
      margin-bottom: 1rem;
    }
    .logo-mark svg { width: 28px; height: 28px; }
    .header h2 {
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      opacity: 0.7;
      margin-bottom: 0.25rem;
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
    }
    .body {
      padding: 3rem;
      text-align: center;
    }
    .body .label {
      font-size: 0.875rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.5rem;
    }
    .body .name {
      font-size: 2rem;
      font-weight: 700;
      color: oklch(0.17 0.015 280);
      margin-bottom: 1.5rem;
    }
    .body .course {
      font-size: 1.125rem;
      font-weight: 600;
      color: oklch(0.637 0.237 25.331);
      margin-bottom: 2rem;
    }
    .details {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #eee;
    }
    .details .item { text-align: center; }
    .details .item .detail-label {
      font-size: 0.75rem;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .details .item .detail-value {
      font-size: 0.9375rem;
      font-weight: 600;
      color: oklch(0.17 0.015 280);
      margin-top: 0.25rem;
    }
    .footer {
      background: oklch(0.975 0.002 260);
      padding: 1.25rem 3rem;
      text-align: center;
      font-size: 0.8125rem;
      color: #888;
    }
    @media print {
      body { background: white; padding: 0; }
      .certificate { box-shadow: none; border-radius: 0; width: 100%; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </div>
      <h2>Certificate of Completion</h2>
      <h1>The Sensory</h1>
    </div>
    <div class="body">
      <p class="label">This certifies that</p>
      <p class="name">${escapeHtml(data.learnerName)}</p>
      <p class="label">has successfully completed</p>
      <p class="course">${escapeHtml(data.courseTitle)}</p>
      <div class="details">
        <div class="item">
          <p class="detail-label">Date Completed</p>
          <p class="detail-value">${formattedDate}</p>
        </div>
        <div class="item">
          <p class="detail-label">Duration</p>
          <p class="detail-value">${escapeHtml(data.courseDuration)}</p>
        </div>
        <div class="item">
          <p class="detail-label">Accreditation</p>
          <p class="detail-value">CPD Certified</p>
        </div>
      </div>
    </div>
    <div class="footer">
      The Sensory Submarine &middot; The Little Sensory Explorers &middot; Sensory Eaters Programme
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
