// ============================================================================
// PULSEPOLL CHART PNG EXPORTER
// Generates high-DPI (Retina), beautifully styled infographic PNG images
// directly from poll data using native HTML5 Canvas with zero dependencies.
// ============================================================================

export function exportChartPng(poll) {
  if (!poll || !poll.options || poll.options.length === 0) {
    alert('No poll data available to export.');
    return;
  }

  const options = poll.options;
  const totalVotes = poll.total_votes || 0;
  const maxVotes = Math.max(...options.map((o) => o.votes || 0), 0);

  // Logical canvas dimensions
  const width = 900;
  const padding = 45;
  const contentWidth = width - padding * 2;
  const optionHeight = 72;
  const headerHeight = 160;
  const footerHeight = 70;
  const height = headerHeight + options.length * optionHeight + footerHeight;

  // 2x Scaling for sharp High-DPI / Retina output
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background Gradient (Sleek Dark Theme)
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#0b0f19');
  bgGradient.addColorStop(0.5, '#0f172a');
  bgGradient.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle Outer Glass Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Top Header: Branding & Badges
  // Brand Tag
  ctx.font = '700 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#818cf8';
  ctx.fillText('⚡ PULSEPOLL — LIVE RESULTS', padding, 48);

  // Share Code Pill
  const codeText = `CODE: ${poll.code || 'LIVE'}`;
  ctx.font = '700 12px monospace';
  const codeWidth = ctx.measureText(codeText).width + 18;
  const codeX = width - padding - codeWidth;
  ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
  roundRect(ctx, codeX, 32, codeWidth, 24, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
  ctx.stroke();
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText(codeText, codeX + 9, 48);

  // Total Votes Badge
  const votesText = `${totalVotes} Total Votes`;
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  const votesWidth = ctx.measureText(votesText).width + 18;
  const votesX = codeX - votesWidth - 10;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  roundRect(ctx, votesX, 32, votesWidth, 24, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(votesText, votesX + 9, 48);

  // Poll Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 22px system-ui, -apple-system, sans-serif';
  const titleY = 92;
  // Truncate title if too long to fit
  let displayTitle = poll.title;
  while (ctx.measureText(displayTitle).width > contentWidth && displayTitle.length > 10) {
    displayTitle = displayTitle.slice(0, -4) + '...';
  }
  ctx.fillText(displayTitle, padding, titleY);

  // Subtitle / Date
  ctx.font = '500 12px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  const createdDate = poll.created_at ? new Date(poll.created_at).toLocaleDateString() : new Date().toLocaleDateString();
  ctx.fillText(`Audience Polling Results • Created ${createdDate}`, padding, titleY + 24);

  // Divider Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(padding, titleY + 38);
  ctx.lineTo(width - padding, titleY + 38);
  ctx.stroke();

  // Render Options
  let startY = headerHeight;
  options.forEach((opt, idx) => {
    const votes = opt.votes || 0;
    const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
    const isLeader = maxVotes > 0 && votes === maxVotes;
    const barColor = opt.color || '#6366f1';

    // Option Label Row
    ctx.fillStyle = isLeader ? '#fef08a' : '#f8fafc';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    
    // Color dot
    ctx.beginPath();
    ctx.arc(padding + 7, startY + 12, 6, 0, Math.PI * 2);
    ctx.fillStyle = barColor;
    ctx.fill();

    // Text label
    ctx.fillStyle = '#f8fafc';
    let optText = opt.text;
    if (isLeader && totalVotes > 1) optText += '  🏆 Leading';
    ctx.fillText(optText, padding + 22, startY + 17);

    // Votes & Percentage on right
    const pctStr = `${pct.toFixed(1)}%`;
    const countStr = `${votes} ${votes === 1 ? 'vote' : 'votes'}`;
    
    ctx.font = '700 15px monospace';
    ctx.fillStyle = isLeader ? '#f59e0b' : '#ffffff';
    const pctWidth = ctx.measureText(pctStr).width;
    ctx.fillText(pctStr, width - padding - pctWidth, startY + 17);

    ctx.font = '500 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    const countWidth = ctx.measureText(countStr).width;
    ctx.fillText(countStr, width - padding - pctWidth - countWidth - 14, startY + 17);

    // Progress Bar Track
    const barY = startY + 28;
    const barHeight = 14;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundRect(ctx, padding, barY, contentWidth, barHeight, 7);
    ctx.fill();

    // Progress Bar Fill
    const fillWidth = Math.max(pct > 0 ? (contentWidth * pct) / 100 : 0, 8);
    if (pct > 0) {
      ctx.fillStyle = barColor;
      roundRect(ctx, padding, barY, fillWidth, barHeight, 7);
      ctx.fill();
    }

    startY += optionHeight;
  });

  // Footer: PulsePoll Watermark & Timestamp
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(padding, height - 48);
  ctx.lineTo(width - padding, height - 48);
  ctx.stroke();

  ctx.font = '500 11px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Generated live by PulsePoll Engine', padding, height - 24);

  const timeStr = new Date().toLocaleString();
  const timeWidth = ctx.measureText(timeStr).width;
  ctx.fillText(timeStr, width - padding - timeWidth, height - 24);

  // Trigger PNG download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (poll.title || 'poll').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
    link.download = `${poll.code || 'poll'}_${safeTitle}_chart.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// Helper: Rounded Rectangle
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
