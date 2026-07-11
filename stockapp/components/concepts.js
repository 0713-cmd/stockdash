// ═══════════════════════════════════════════════════
// 디자인 컨셉 3종 — 팔레트 + 레이아웃 모드
// A: 클린 테이블(인베스팅닷컴풍) · B: 소프트 카드(토스풍) · C: 뉴트럴 대시보드(구글파이낸스풍)
// ═══════════════════════════════════════════════════

export const CONCEPTS = {
  A: {
    id: 'A', label: 'A 테이블', desc: '정보 밀도 높은 랭킹 테이블',
    nav: 'top',
    vars: `
      --bg:#f7f6f2;--bg2:#ffffff;--bg3:#f1efe8;--bg4:#e4e2d8;
      --text:#3d3d3a;--strong:#191917;--dim:#9a988e;--dim2:#5f5e5a;
      --line:rgba(60,60,50,0.10);--line2:rgba(60,60,50,0.18);
      --gold:#8f6a10;--gold2:#6e5109;
      --green:#137333;--red:#c5221f;--blue:#185fa5;--pur:#534ab7;
      --green-bg:rgba(19,115,51,.08);--green-bd:rgba(19,115,51,.35);
      --red-bg:rgba(197,34,31,.07);--red-bd:rgba(197,34,31,.35);
      --gold-bg:rgba(143,106,16,.09);--gold-bd:rgba(143,106,16,.35);
      --pur-bg:rgba(83,74,183,.08);--pur-bd:rgba(83,74,183,.32);
      --blue-bg:rgba(24,95,165,.08);--blue-bd:rgba(24,95,165,.32);
    `,
  },
  B: {
    id: 'B', label: 'B 카드', desc: '결론 중심 소프트 카드',
    nav: 'bottom',
    vars: `
      --bg:#f2f4f6;--bg2:#ffffff;--bg3:#f7f8fa;--bg4:#e9ebee;
      --text:#333d4b;--strong:#191f28;--dim:#8b95a1;--dim2:#4e5968;
      --line:rgba(2,32,71,0.07);--line2:rgba(2,32,71,0.13);
      --gold:#b46c0f;--gold2:#8f5409;
      --green:#0a8f4d;--red:#e0344c;--blue:#3182f6;--pur:#7048e8;
      --green-bg:rgba(10,143,77,.08);--green-bd:rgba(10,143,77,.30);
      --red-bg:rgba(224,52,76,.07);--red-bd:rgba(224,52,76,.30);
      --gold-bg:rgba(180,108,15,.09);--gold-bd:rgba(180,108,15,.32);
      --pur-bg:rgba(112,72,232,.08);--pur-bd:rgba(112,72,232,.30);
      --blue-bg:rgba(49,130,246,.08);--blue-bd:rgba(49,130,246,.30);
    `,
  },
  C: {
    id: 'C', label: 'C 대시보드', desc: '사이드 메뉴 미니멀',
    nav: 'side',
    vars: `
      --bg:#ffffff;--bg2:#ffffff;--bg3:#f8f9fa;--bg4:#e8eaed;
      --text:#3c4043;--strong:#202124;--dim:#9aa0a6;--dim2:#5f6368;
      --line:rgba(32,33,36,0.10);--line2:rgba(32,33,36,0.16);
      --gold:#b05a00;--gold2:#8a4600;
      --green:#137333;--red:#a50e0e;--blue:#1a73e8;--pur:#8430ce;
      --green-bg:rgba(19,115,51,.07);--green-bd:rgba(19,115,51,.32);
      --red-bg:rgba(165,14,14,.06);--red-bd:rgba(165,14,14,.32);
      --gold-bg:rgba(176,90,0,.08);--gold-bd:rgba(176,90,0,.32);
      --pur-bg:rgba(132,48,206,.07);--pur-bd:rgba(132,48,206,.30);
      --blue-bg:rgba(26,115,232,.07);--blue-bd:rgba(26,115,232,.30);
    `,
  },
  dark: {
    id: 'dark', label: '🌙 다크', desc: '기존 다크 테마',
    nav: 'bottom',
    vars: `
      --bg:#0b0c12;--bg2:#12131e;--bg3:#1a1b2a;--bg4:#222336;
      --text:#dde0f0;--strong:#ffffff;--dim:#55597a;--dim2:#8890b0;
      --line:rgba(255,255,255,0.05);--line2:rgba(255,255,255,0.10);
      --gold:#c9a84c;--gold2:#e8c87a;
      --green:#00d98a;--red:#ff3f5c;--blue:#4d9fff;--pur:#9b8fff;
      --green-bg:rgba(0,217,138,.10);--green-bd:rgba(0,217,138,.22);
      --red-bg:rgba(255,63,92,.10);--red-bd:rgba(255,63,92,.22);
      --gold-bg:rgba(201,168,76,.10);--gold-bd:rgba(201,168,76,.28);
      --pur-bg:rgba(155,143,255,.10);--pur-bd:rgba(155,143,255,.28);
      --blue-bg:rgba(77,159,255,.10);--blue-bd:rgba(77,159,255,.28);
    `,
  },
};

// MARS-V 신호 → B컨셉 말투 칩
export const verdictChip = (signal, lite, score, upside) => {
  if (!lite) {
    return {
      BUY:    { t: '사볼만해요', col: 'var(--green)', bg: 'var(--green-bg)', bd: 'var(--green-bd)' },
      HOLD:   { t: '들고가요', col: 'var(--gold)', bg: 'var(--gold-bg)', bd: 'var(--gold-bd)' },
      NEUTRAL:{ t: '지켜봐요', col: 'var(--dim2)', bg: 'var(--bg3)', bd: 'var(--line2)' },
      WAIT:   { t: '기다려요', col: 'var(--red)', bg: 'var(--red-bg)', bd: 'var(--red-bd)' },
      DANGER: { t: '조심해요', col: 'var(--red)', bg: 'var(--red-bg)', bd: 'var(--red-bd)' },
      UNKNOWN:{ t: '로딩 중', col: 'var(--dim)', bg: 'var(--bg3)', bd: 'var(--line2)' },
    }[signal] || { t: '—', col: 'var(--dim)', bg: 'var(--bg3)', bd: 'var(--line2)' };
  }
  // lite 종목: MARS-V 미산정 → 점수·업사이드 기반 참고 칩
  if (score >= 70 && upside != null && upside > 10) return { t: '관심(점수기반)', col: 'var(--green)', bg: 'var(--green-bg)', bd: 'var(--green-bd)' };
  if (score >= 55) return { t: '지켜봐요', col: 'var(--dim2)', bg: 'var(--bg3)', bd: 'var(--line2)' };
  return { t: '보류', col: 'var(--dim)', bg: 'var(--bg3)', bd: 'var(--line2)' };
};

// A/C 컨셉용 짧은 신호 라벨
export const signalShort = (signal, lite, score, upside) => {
  if (!lite) return { BUY:['매수','var(--green)'],HOLD:['보유','var(--gold)'],NEUTRAL:['중립','var(--dim2)'],WAIT:['대기','var(--red)'],DANGER:['위험','var(--red)'],UNKNOWN:['—','var(--dim)'] }[signal] || ['—','var(--dim)'];
  if (score >= 70 && upside != null && upside > 10) return ['관심','var(--green)'];
  return ['—','var(--dim)'];
};
