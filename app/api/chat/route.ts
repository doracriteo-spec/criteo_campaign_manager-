import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Message { role: 'user' | 'assistant'; content: string; }

interface NodeContext {
  name: string;
  level: string;
  pacing: {
    actual_spend: number;
    expected_spend: number;
    pacing_ratio: number;
    pacing_status: string;
    projected_total_spend: number;
    projected_underspend: number;
    has_budget: boolean;
    elapsed_days: number;
    remaining_days: number;
    total_days: number;
  };
  kpi_performance: {
    kpi_name: string;
    kpi_value: number;
    kpi_trend: string;
    secondary_metrics: Record<string, number>;
  };
  risks: Array<{ severity: string; title: string; description: string }>;
}

interface ChatContext {
  summary?: {
    total_accounts: number;
    total_spend: number;
    total_budget: number;
    overall_pacing: number;
    total_rows: number;
    total_impressions: number;
    total_conversions: number;
  };
  config?: {
    currency: string;
    kpi: string;
    start_date?: string;
    end_date?: string;
    account_name?: string;
  };
  currentNode?: NodeContext;
}

function fmt(n: number, ccy = '$') {
  return `${ccy}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function analyzeQuery(query: string, ctx: ChatContext): string {
  const q = query.toLowerCase();
  const node = ctx.currentNode;
  const summary = ctx.summary;
  const config = ctx.config;
  const ccy = config?.currency === 'EUR' ? '€' : '$';

  // ─── Pacing Questions ──────────────────────────────────────────────────────
  if (q.includes('pacing') || q.includes('on track') || q.includes('spending') || q.includes('underspend') || q.includes('overspend')) {
    if (node) {
      const p = node.pacing;
      const kpi = node.kpi_performance;
      const pacingPct = Math.round(p.pacing_ratio * 100);
      let response = `### ⚡ Pacing Report: ${node.name}\n\n`;

      if (!p.has_budget) {
        response += `No budget is configured for this ${node.level}. To enable pacing analysis, set a total budget in the campaign configuration.\n\n`;
        response += `**Current Spend:** ${fmt(p.actual_spend, ccy)}\n`;
        response += `**Run Rate:** ${fmt(p.elapsed_days > 0 ? p.actual_spend / p.elapsed_days : 0, ccy)}/day\n`;
      } else {
        response += `**Pacing Status:** ${p.pacing_status} (${pacingPct}% of expected)\n`;
        response += `**Spend:** ${fmt(p.actual_spend, ccy)} vs ${fmt(p.expected_spend, ccy)} expected so far\n`;
        response += `**Flight:** Day ${p.elapsed_days} of ${p.total_days} (${p.remaining_days} days remaining)\n`;
        response += `**Projected Spend:** ${fmt(p.projected_total_spend, ccy)}\n\n`;

        if (p.pacing_status.includes('Underpacing')) {
          const gap = p.expected_spend - p.actual_spend;
          const dailyRecovery = p.remaining_days > 0 ? gap / p.remaining_days : 0;
          response += `⚠️ **Underdelivery Alert:** You are ${fmt(gap, ccy)} behind expected spend.\n`;
          response += `To recover by end of flight, increase daily delivery by approximately **${fmt(dailyRecovery, ccy)}/day**.\n\n`;
          response += `**Recommendations:**\n`;
          response += `- Expand audience targeting or raise bid caps\n`;
          response += `- Check for frequency caps limiting delivery\n`;
          response += `- Review creative fatigue — refresh ad assets if CTR is declining\n`;
        } else if (p.pacing_status.includes('Overpacing')) {
          response += `🔴 **Overspend Risk:** You are ahead of pacing and risk exhausting budget early.\n\n`;
          response += `**Recommendations:**\n`;
          response += `- Reduce daily budget caps by 15-20%\n`;
          response += `- Tighten audience targeting to higher-value segments\n`;
          response += `- Review bid strategy — switch to manual if using auto-bidding\n`;
        } else {
          response += `✅ **On Track:** Spend is aligned with expected delivery for this flight period.\n\n`;
        }

        if (p.projected_underspend > 0) {
          response += `\n📉 **Projected Underspend:** ${fmt(p.projected_underspend, ccy)} may go unspent if current run rate continues.`;
        }
      }

      // Add KPI context
      response += `\n\n**${kpi.kpi_name}:** ${kpi.kpi_value.toLocaleString()} (Trend: ${kpi.kpi_trend})`;
      return response;
    }

    if (summary) {
      const overallPct = Math.round(summary.overall_pacing * 100);
      return `### 📊 Portfolio Pacing Summary\n\n**Overall Pacing:** ${overallPct}%\n**Total Spend:** ${fmt(summary.total_spend, ccy)}\n**Total Budget:** ${fmt(summary.total_budget, ccy)}\n**Accounts Tracked:** ${summary.total_accounts}\n\nSelect a specific account from the sidebar to drill into its detailed pacing analysis.`;
    }
  }

  // ─── KPI / Performance Questions ──────────────────────────────────────────
  if (q.includes('kpi') || q.includes('performance') || q.includes('ctr') || q.includes('cpc') || q.includes('roas') || q.includes('conversion') || q.includes('visit') || q.includes('clicks') || q.includes('impression')) {
    if (node) {
      const kpi = node.kpi_performance;
      const secondary = kpi.secondary_metrics;
      let response = `### 📈 Performance Analysis: ${node.name}\n\n`;
      response += `**Primary KPI — ${kpi.kpi_name}:** ${kpi.kpi_value.toLocaleString()}\n`;
      response += `**Trend:** ${kpi.kpi_trend === 'Improving' ? '↑ Improving' : kpi.kpi_trend === 'Declining' ? '↓ Declining' : '→ Stable'}\n\n`;

      response += `**Metric Breakdown:**\n`;
      for (const [key, val] of Object.entries(secondary)) {
        response += `- **${key}:** ${typeof val === 'number' ? val.toLocaleString() : val}\n`;
      }

      if (kpi.kpi_trend === 'Declining') {
        response += `\n⚠️ **Declining Trend Detected.** Suggested actions:\n`;
        response += `- Review creative assets — ad fatigue is a common cause\n`;
        response += `- Check audience overlap and frequency caps\n`;
        response += `- Analyze which segments are underperforming and exclude or adjust bids\n`;
      } else if (kpi.kpi_trend === 'Improving') {
        response += `\n✅ **Positive Trend.** Consider:\n`;
        response += `- Scaling budget to accelerate growth\n`;
        response += `- Identifying the top-performing audiences and expanding lookalikes\n`;
      }

      if (secondary['CTR'] && secondary['CTR'] < 0.2) {
        response += `\n💡 CTR of ${secondary['CTR']}% is below average. A/B test new creative formats or headlines.`;
      }

      return response;
    }
  }

  // ─── Budget / Reallocation Questions ──────────────────────────────────────
  if (q.includes('budget') || q.includes('reallocat') || q.includes('shift') || q.includes('transfer') || q.includes('increase') || q.includes('decrease')) {
    if (node) {
      const p = node.pacing;
      let response = `### 💰 Budget Analysis: ${node.name}\n\n`;
      if (p.has_budget) {
        const util = Math.round((p.actual_spend / (p.expected_spend > 0 ? p.expected_spend : 1)) * 100);
        response += `**Utilization:** ${util}% of expected spend consumed\n`;
        response += `**Actual Spend:** ${fmt(p.actual_spend, ccy)}\n`;
        response += `**Expected at This Point:** ${fmt(p.expected_spend, ccy)}\n`;
        response += `**Projected Total:** ${fmt(p.projected_total_spend, ccy)}\n\n`;

        if (p.pacing_ratio < 0.9) {
          const surplusBudget = p.expected_spend - p.actual_spend;
          response += `💡 **Reallocation Opportunity:** ${fmt(surplusBudget, ccy)} of surplus budget can be reallocated to better-performing accounts or ad sets.\n\n`;
          response += `**Reallocation Strategy:**\n`;
          response += `- Identify accounts with pacing > 95% and headroom to scale\n`;
          response += `- Move budget from consistently underpacing entities to high performers\n`;
          response += `- Consider mid-flight adjustments 2-3 weeks before flight end\n`;
        } else if (p.pacing_ratio > 1.1) {
          response += `🔴 **Budget Constraint Risk:** Current run rate may exhaust the budget before flight end.\n\n`;
          response += `**Actions:**\n`;
          response += `- Reduce daily caps immediately to extend delivery\n`;
          response += `- If additional budget is available, request approval for a budget uplift\n`;
        }
      } else {
        response += `No budget is configured. Use the Budget Planner in the left sidebar to set a campaign budget and enable pacing calculations.\n`;
      }
      return response;
    }
  }

  // ─── Risk Questions ────────────────────────────────────────────────────────
  if (q.includes('risk') || q.includes('issue') || q.includes('problem') || q.includes('concern') || q.includes('alert') || q.includes('flag')) {
    if (node && node.risks.length > 0) {
      let response = `### ⚠️ Risk Assessment: ${node.name}\n\n`;
      response += `**${node.risks.length} risk(s) identified:**\n\n`;
      for (const risk of node.risks) {
        const icon = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
        response += `${icon} **${risk.title}** (${risk.severity.toUpperCase()})\n`;
        response += `${risk.description}\n\n`;
      }
      return response;
    } else if (node) {
      return `✅ **No critical risks detected for ${node.name}.** Pacing and performance metrics are within acceptable thresholds.\n\nContinue monitoring daily delivery and check back if spend patterns shift significantly.`;
    }
  }

  // ─── Email Draft ────────────────────────────────────────────────────────────
  if (q.includes('email') || q.includes('draft') || q.includes('client') || q.includes('update') || q.includes('report')) {
    if (node) {
      const p = node.pacing;
      const kpi = node.kpi_performance;
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      let email = `### 📧 Client Email Draft\n\n`;
      email += `---\n`;
      email += `**Subject:** ${node.name} — Campaign Performance Update (${today})\n\n`;
      email += `Hi [Client Name],\n\n`;
      email += `I wanted to share a quick performance update for the **${node.name}** campaign.\n\n`;
      email += `**Performance Highlights:**\n`;
      email += `- **${kpi.kpi_name}:** ${kpi.kpi_value.toLocaleString()} (${kpi.kpi_trend} trend)\n`;
      if (p.has_budget) {
        email += `- **Budget Utilization:** ${Math.round(p.pacing_ratio * 100)}% paced — ${p.pacing_status}\n`;
        email += `- **Total Spend to Date:** ${fmt(p.actual_spend, ccy)}\n`;
        if (p.remaining_days > 0) {
          email += `- **Days Remaining:** ${p.remaining_days} of ${p.total_days}\n`;
        }
      }
      const secMetrics = kpi.secondary_metrics;
      if (secMetrics['CTR']) email += `- **CTR:** ${secMetrics['CTR']}%\n`;
      if (secMetrics['CPC']) email += `- **CPC:** ${fmt(secMetrics['CPC'], ccy)}\n`;
      if (secMetrics['ROAS']) email += `- **ROAS:** ${secMetrics['ROAS']}x\n`;

      email += `\n**Next Steps:**\n`;
      if (p.pacing_status?.includes('Under')) {
        email += `- We are currently monitoring delivery and will be adjusting bids and targeting to improve pacing over the next few days.\n`;
      } else if (p.pacing_status?.includes('Over')) {
        email += `- We have applied budget pacing controls to ensure we stay within the allocated budget for the flight period.\n`;
      } else {
        email += `- Campaign is delivering as expected. We will continue monitoring performance and will flag any anomalies.\n`;
      }
      email += `\nPlease let me know if you have any questions or would like to discuss strategy.\n\n`;
      email += `Best regards,\n[Your Name]\n\n---`;
      return email;
    }
  }

  // ─── Anomaly / Trend Questions ─────────────────────────────────────────────
  if (q.includes('anomal') || q.includes('unusual') || q.includes('spike') || q.includes('drop') || q.includes('trend')) {
    if (node) {
      const kpi = node.kpi_performance;
      const p = node.pacing;
      let response = `### 🔍 Anomaly & Trend Analysis: ${node.name}\n\n`;

      if (kpi.kpi_trend === 'Declining') {
        response += `⚠️ **Declining KPI Trend:** ${kpi.kpi_name} is trending down in the second half of the data period.\n\n`;
        response += `Possible causes:\n- Creative fatigue (ad assets may need refreshing)\n- Audience saturation in key segments\n- Increased competition driving up CPCs\n- Seasonal demand shift\n\n`;
      } else if (kpi.kpi_trend === 'Improving') {
        response += `📈 **Positive KPI Trend:** ${kpi.kpi_name} has been improving — great signal for campaign health.\n\n`;
      } else {
        response += `→ **Stable Performance:** No significant trend anomalies detected in the KPI data.\n\n`;
      }

      if (p.has_budget && Math.abs(p.pacing_ratio - 1) > 0.15) {
        response += `⚡ **Pacing Anomaly:** Spend is ${Math.round(Math.abs(p.pacing_ratio - 1) * 100)}% ${p.pacing_ratio > 1 ? 'above' : 'below'} expected — investigate delivery settings.\n`;
      }

      return response;
    }
  }

  // ─── Strategy / Suggestions ────────────────────────────────────────────────
  if (q.includes('suggest') || q.includes('recommend') || q.includes('strateg') || q.includes('improve') || q.includes('optimiz') || q.includes('what should') || q.includes('how to') || q.includes('action')) {
    if (node) {
      const p = node.pacing;
      const kpi = node.kpi_performance;
      let response = `### 🎯 Strategic Recommendations: ${node.name}\n\n`;

      if (p.has_budget) {
        if (p.pacing_ratio < 0.9) {
          response += `**1. Address Underspend**\n- Raise daily budget caps by 20-30%\n- Broaden audience targeting or add new audience segments\n- Review bid strategy and consider increasing max CPC/CPM\n\n`;
        } else if (p.pacing_ratio > 1.1) {
          response += `**1. Control Overspend**\n- Lower daily budget caps by 15-25%\n- Narrow targeting to highest-ROI segments\n- Pause low-performing ad sets to focus budget\n\n`;
        }
      }

      if (kpi.kpi_trend === 'Declining') {
        response += `**2. Reverse Declining Trend**\n- Run creative A/B tests with fresh assets\n- Refresh audience lists with new lookalikes\n- Analyze day-parting and device performance\n\n`;
      }

      const secondary = kpi.secondary_metrics;
      if (secondary['CTR'] && secondary['CTR'] < 0.2) {
        response += `**3. Improve CTR (Currently ${secondary['CTR']}%)**\n- Test new ad formats (carousel, video, dynamic)\n- Sharpen value propositions in ad copy\n- Target audiences with higher purchase intent signals\n\n`;
      }

      if (secondary['CPC'] && secondary['CPC'] > 2) {
        response += `**4. Reduce CPC (Currently ${fmt(secondary['CPC'], '$')})**\n- Use Smart Bidding or Target CPA strategies\n- Improve Quality Score by enhancing landing page relevance\n- Increase ad relevance to lower auction costs\n\n`;
      }

      response += `💡 Use the **Budget Planner** in the sidebar to model different spend scenarios and calculate daily recovery rates.`;
      return response;
    }
  }

  // ─── General / Help / Greeting ─────────────────────────────────────────────
  if (q.includes('hello') || q.includes('hi') || q.includes('help') || q.includes('what can you') || q.includes('what do you')) {
    return `### 👋 Hello! I'm your AI Campaign Analyst.\n\nI analyze your **live CSV/Excel campaign data** to provide actionable pacing and performance insights. Here's what I can help with:\n\n- **Pacing Analysis** — Am I on track? Will I underspend?\n- **KPI Performance** — How are my conversions, ROAS, CTR trending?\n- **Budget Recommendations** — Should I reallocate? Where is the headroom?\n- **Risk Identification** — What are the active risks in this campaign?\n- **Email Drafts** — Draft a performance update for my client\n- **Strategic Advice** — What should I change to improve results?\n\nSelect an account from the sidebar and ask me anything about its performance!`;
  }

  // ─── Overview / Summary ────────────────────────────────────────────────────
  if (q.includes('summar') || q.includes('overview') || q.includes('status') || q.includes('analyz') || q.includes('tell me about')) {
    if (node) {
      const p = node.pacing;
      const kpi = node.kpi_performance;
      let response = `### 📊 Campaign Overview: ${node.name}\n\n`;
      response += `**Level:** ${node.level.charAt(0).toUpperCase() + node.level.slice(1)}\n`;
      response += `**Primary KPI:** ${kpi.kpi_name} = ${kpi.kpi_value.toLocaleString()} (${kpi.kpi_trend})\n\n`;

      if (p.has_budget) {
        response += `**Pacing:** ${p.pacing_status} at ${Math.round(p.pacing_ratio * 100)}%\n`;
        response += `**Spend:** ${fmt(p.actual_spend, ccy)} of ~${fmt(p.expected_spend, ccy)} expected\n`;
        response += `**Days Remaining:** ${p.remaining_days}\n`;
        response += `**Projected Spend:** ${fmt(p.projected_total_spend, ccy)}\n`;
        if (p.projected_underspend > 0) {
          response += `\n⚠️ Projected underspend: ${fmt(p.projected_underspend, ccy)}\n`;
        }
      }

      response += `\n**Metrics:**\n`;
      for (const [k, v] of Object.entries(kpi.secondary_metrics)) {
        response += `- ${k}: ${typeof v === 'number' ? v.toLocaleString() : v}\n`;
      }

      if (node.risks.length > 0) {
        response += `\n**Risks:** ${node.risks.map(r => r.title).join(', ')}\n`;
      }

      return response;
    }

    if (summary) {
      let response = `### 📊 Portfolio Summary\n\n`;
      response += `**Accounts:** ${summary.total_accounts}\n`;
      response += `**Total Spend:** ${fmt(summary.total_spend, ccy)}\n`;
      response += `**Total Budget:** ${fmt(summary.total_budget, ccy)}\n`;
      response += `**Overall Pacing:** ${Math.round(summary.overall_pacing * 100)}%\n`;
      response += `**Total Impressions:** ${summary.total_impressions.toLocaleString()}\n`;
      response += `**Total Conversions:** ${summary.total_conversions.toLocaleString()}\n\n`;
      response += `Select an account from the sidebar for a detailed drill-down.`;
      return response;
    }
  }

  // ─── Default Fallback ──────────────────────────────────────────────────────
  if (node) {
    const p = node.pacing;
    const kpi = node.kpi_performance;
    return `I'm analyzing **${node.name}** based on your uploaded CSV data.\n\n**Quick Snapshot:**\n- **KPI (${kpi.kpi_name}):** ${kpi.kpi_value.toLocaleString()} — ${kpi.kpi_trend}\n- **Pacing:** ${p.has_budget ? `${p.pacing_status} (${Math.round(p.pacing_ratio * 100)}%)` : 'No budget set'}\n- **Spend:** ${fmt(p.actual_spend, ccy)}${p.has_budget ? ` of ${fmt(p.expected_spend, ccy)} expected` : ''}\n\nTry asking me about **pacing**, **performance**, **budget reallocation**, or to **draft a client email**.`;
  }

  return `I'm ready to analyze your campaign data! Try asking:\n- "How is this campaign pacing?"\n- "What should we change to improve ROAS?"\n- "Flag any spend anomalies"\n- "Draft a quick email update to the client"\n\nSelect an account from the sidebar to load its context first.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, context } = body as { messages: Message[]; context?: ChatContext };

    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMessage?.content || '';

    const reply = analyzeQuery(query, context || {});

    return NextResponse.json({ reply, text: reply });
  } catch (err: any) {
    console.error('Chat route error:', err);
    return NextResponse.json(
      { error: err.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
