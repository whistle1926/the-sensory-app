interface CertificateData {
  learnerName: string;
  courseTitle: string;
  courseDuration: string;
  completionDate: Date;
}

/**
 * A course-completion certificate, wearing the Sensory Submarine brand:
 * cream ground, navy ink, the Baloo display face, the round submarine
 * logo, and a chunky bordered card with the brand's offset-shadow look.
 *
 * Opened as a standalone HTML page (and printed to PDF), so fonts come in
 * via @import and the logo is an absolute URL — a relative path would
 * break once the page is saved or printed from a file. Grace's steer
 * (Sept 2026): no accreditation line on these — the courses aren't all
 * CPD-accredited, so claiming it on every certificate would overstate it.
 */
export function generateCertificateHTML(data: CertificateData): string {
  const formattedDate = data.completionDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const name = (data.learnerName || "").trim() || "Course learner";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificate of Completion — ${escapeHtml(data.courseTitle)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --cream: #FFF8EC;
      --navy: #12235B;
      --navy-deep: #0A1740;
      --pink: #E71D57;
      --yellow: #FFC93C;
      --teal: #17B0A7;
      --ink: #3D4A6B;
      --ink-soft: #6B7794;
    }
    body {
      font-family: 'Nunito', system-ui, sans-serif;
      background: var(--cream);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
      color: var(--navy);
    }
    .display { font-family: 'Baloo 2', 'Nunito', system-ui, sans-serif; }
    .certificate {
      position: relative;
      width: 820px;
      background: #fff;
      border: 4px solid var(--navy);
      border-radius: 28px;
      overflow: hidden;
      box-shadow: 12px 12px 0 var(--yellow);
    }
    /* Colour ribbon along the very top */
    .ribbon { display: flex; height: 10px; }
    .ribbon span { flex: 1; }
    .ribbon .a { background: var(--pink); }
    .ribbon .b { background: var(--yellow); }
    .ribbon .c { background: var(--teal); }
    .header {
      background: var(--navy);
      color: #fff;
      padding: 2.25rem 3rem 2rem;
      text-align: center;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 84px;
      height: 84px;
      background: #fff;
      border: 4px solid var(--navy-deep);
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .logo-mark img { width: 100%; height: 100%; object-fit: cover; }
    .header h2 {
      font-size: 0.8125rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      color: var(--yellow);
      margin-bottom: 0.4rem;
    }
    .header h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.01em; }
    .body { padding: 3rem 3rem 2.5rem; text-align: center; }
    .body .label {
      font-size: 0.8125rem;
      color: var(--ink-soft);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 0.5rem;
    }
    .body .name {
      font-size: 2.6rem;
      font-weight: 800;
      color: var(--navy);
      letter-spacing: -0.01em;
      margin-bottom: 1.5rem;
      line-height: 1.1;
    }
    /* Playful underline under the name, in the brand pink */
    .body .name-rule {
      width: 120px;
      height: 5px;
      border-radius: 999px;
      background: var(--pink);
      margin: -0.6rem auto 1.5rem;
    }
    .body .course {
      font-size: 1.375rem;
      font-weight: 800;
      color: var(--pink);
      margin-bottom: 2rem;
    }
    .details {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-top: 1.5rem;
      padding-top: 1.75rem;
      border-top: 3px solid #F2E4CD;
    }
    .details .item {
      text-align: center;
      background: var(--cream);
      border: 3px solid var(--navy);
      border-radius: 18px;
      box-shadow: 4px 4px 0 var(--teal);
      padding: 0.9rem 1.6rem;
      min-width: 190px;
    }
    .details .item .detail-label {
      font-size: 0.7rem;
      color: var(--ink-soft);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .details .item .detail-value {
      font-size: 1rem;
      font-weight: 800;
      color: var(--navy);
      margin-top: 0.3rem;
    }
    .footer {
      background: var(--cream);
      border-top: 3px solid #F2E4CD;
      padding: 1.1rem 3rem;
      text-align: center;
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--ink-soft);
    }
    @media print {
      body { background: #fff; padding: 0; }
      .certificate { box-shadow: none; border-radius: 0; width: 100%; border: none; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="ribbon"><span class="a"></span><span class="b"></span><span class="c"></span></div>
    <div class="header">
      <div class="logo-mark">
        <img src="https://portal.thesensorysubmarine.com/brand/logo-mark.jpg" alt="The Sensory Submarine" />
      </div>
      <h2>Certificate of Completion</h2>
      <h1 class="display">The Sensory Submarine</h1>
    </div>
    <div class="body">
      <p class="label">This certifies that</p>
      <p class="name display">${escapeHtml(name)}</p>
      <div class="name-rule"></div>
      <p class="label">has successfully completed</p>
      <p class="course display">${escapeHtml(data.courseTitle)}</p>
      <div class="details">
        <div class="item">
          <p class="detail-label">Date completed</p>
          <p class="detail-value">${formattedDate}</p>
        </div>
        <div class="item">
          <p class="detail-label">Duration</p>
          <p class="detail-value">${escapeHtml(data.courseDuration)}</p>
        </div>
      </div>
    </div>
    <div class="footer">
      The Sensory Submarine &middot; Occupational Therapy Services &middot; Northern Ireland
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
