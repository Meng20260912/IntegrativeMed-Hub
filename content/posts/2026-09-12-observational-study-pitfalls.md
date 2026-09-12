---
title: 讀中西醫整合的觀察性研究：兩個讓中醫看起來特別有效的分析陷阱
slug: observational-study-pitfalls
author: 魏孟鈞/台北慈濟醫院中醫部中醫內科主治醫師
date: 2026-09-12
summary: 健保資料庫研究報告接受中西合療的病人存活較好，風險比 0.6。這個數字可信嗎？不死時間偏差與資訊性設限機轉不同，方向卻一致，都會讓中醫顯得比實際更有保護力。
hero: lab.jpg
heroAlt: 研究人員在實驗室進行精密移液操作
tags: [研究方法, 實證醫學, 健保資料庫]
---

你讀到一篇健保資料庫研究：接受中西合療的癌症病人，死亡風險比未接受者低了四成，風險比（hazard ratio）0.6，信賴區間漂亮，樣本數上萬。

但是，這個數字可信嗎？真的代表中醫介入更好嗎？

在討論療效之前，有兩個與**時間**有關的分析陷阱必須先排除。它們的機轉不同，偏差方向卻一致——都會讓中醫看起來比實際更有保護力。

## 第一個問題：誰有機會成為暴露組

台灣的健保資料庫研究，收案對象幾乎都是自行決定要不要看中醫的病人。體力狀況較好、經濟條件較佳、行動能力足以自行往返中醫院所的人，本來就有較好的預後。這是典型的**選擇偏誤（selection bias）**。

這一點多數研究者知道，也會用傾向分數配對（propensity score matching）等方式處理。但配對只能平衡**有被記錄下來的變項**。健保資料庫沒有體能狀態分級、沒有腫瘤分期細節、沒有家庭支持程度，而這些恰好是決定病人有沒有餘力去看中醫的關鍵因素。配對做得再漂亮，殘餘干擾仍然存在。

真正容易被整個略過的，是下面兩個與時間有關的問題。

<figure class="diagram">
<svg viewBox="0 0 720 480" role="img" aria-labelledby="itb-t itb-d" xmlns="http://www.w3.org/2000/svg">
<title id="itb-t">不死時間偏差與資訊性設限的對照圖</title>
<desc id="itb-d">上半部為不死時間偏差：診斷到首次中醫就診之間，死亡者依定義不會被歸入中醫組，若把這段算進中醫組追蹤期會高估保護效果。下半部為資訊性設限：病人因併發症停用中藥後死亡，這段期間病人可能死亡，不屬於不死時間；若在停藥處設限，會把死亡事件移出中醫組。</desc>
<style>
.itb-lb{font:600 13px var(--sans,sans-serif);fill:var(--ink,#16202b)}
.itb-sm{font:12px var(--sans,sans-serif);fill:var(--ink-3,#8695a4)}
.itb-tag{font:600 12px var(--sans,sans-serif)}
.itb-hd{font:700 13px var(--sans,sans-serif);fill:var(--navy,#12395f)}
.itb-ax{stroke:var(--line,#e0e7ef);stroke-width:1}
.itb-tick{stroke:var(--ink-3,#8695a4);stroke-width:1.5}
</style>
<defs>
<pattern id="itbHatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
<rect width="7" height="7" fill="var(--navy,#12395f)" opacity=".13"/>
<line x1="0" y1="0" x2="0" y2="7" stroke="var(--navy,#12395f)" stroke-width="2.5" opacity=".5"/>
</pattern>
</defs>

<text class="itb-hd" x="8" y="18">一、不死時間偏差（immortal time bias）</text>
<line class="itb-tick" x1="180" y1="52" x2="180" y2="250"/>
<line class="itb-tick" x1="400" y1="52" x2="400" y2="250" stroke-dasharray="4 4"/>
<text class="itb-sm" x="180" y="44" text-anchor="middle">診斷日</text>
<text class="itb-sm" x="400" y="44" text-anchor="middle">首次中醫就診</text>
<text class="itb-sm" x="714" y="44" text-anchor="end">追蹤結束</text>

<text class="itb-lb" x="8" y="82">錯誤分析</text>
<text class="itb-sm" x="8" y="100">整段算中醫組</text>
<rect x="180" y="64" width="480" height="32" rx="6" fill="var(--navy,#12395f)" opacity=".9"/>
<rect x="180" y="64" width="220" height="32" rx="6" fill="url(#itbHatch)"/>
<text class="itb-tag" x="290" y="85" text-anchor="middle" fill="#fff">不死時間</text>
<text class="itb-tag" x="530" y="85" text-anchor="middle" fill="#fff">實際接受中醫</text>
<text class="itb-sm" x="290" y="118" text-anchor="middle">死亡者依定義不會被歸入中醫組</text>

<text class="itb-lb" x="8" y="168">正確處理</text>
<text class="itb-sm" x="8" y="186">時間相依變項</text>
<rect x="180" y="150" width="220" height="32" rx="6" fill="var(--surface-2,#eef3f8)" stroke="var(--line,#e0e7ef)"/>
<text class="itb-tag" x="290" y="171" text-anchor="middle" fill="var(--ink-2,#4c5a68)">計為未暴露</text>
<rect x="400" y="150" width="260" height="32" rx="6" fill="var(--navy,#12395f)" opacity=".9"/>
<text class="itb-tag" x="530" y="171" text-anchor="middle" fill="#fff">計為中醫組</text>
<text class="itb-sm" x="290" y="204" text-anchor="middle">時間零點對齊，兩組起點相同</text>

<line class="itb-ax" x1="8" y1="246" x2="712" y2="246"/>

<text class="itb-hd" x="8" y="278">二、資訊性設限（informative censoring）</text>
<line class="itb-tick" x1="180" y1="312" x2="180" y2="430"/>
<line class="itb-tick" x1="330" y1="312" x2="330" y2="430" stroke-dasharray="4 4"/>
<line class="itb-tick" x1="520" y1="312" x2="520" y2="430" stroke-dasharray="4 4"/>
<text class="itb-sm" x="180" y="304" text-anchor="middle">診斷日</text>
<text class="itb-sm" x="330" y="304" text-anchor="middle">開始中醫</text>
<text class="itb-sm" x="520" y="304" text-anchor="middle">因併發症停用中藥</text>
<text class="itb-sm" x="640" y="304" text-anchor="middle">死亡</text>

<rect x="180" y="324" width="150" height="32" rx="6" fill="var(--surface-2,#eef3f8)" stroke="var(--line,#e0e7ef)"/>
<text class="itb-tag" x="255" y="345" text-anchor="middle" fill="var(--ink-2,#4c5a68)">未暴露</text>
<rect x="330" y="324" width="190" height="32" rx="6" fill="var(--navy,#12395f)" opacity=".9"/>
<text class="itb-tag" x="425" y="345" text-anchor="middle" fill="#fff">接受中醫</text>
<rect x="520" y="324" width="120" height="32" rx="6" fill="var(--accent-warn,#b4553f)" opacity=".85"/>
<text class="itb-tag" x="580" y="345" text-anchor="middle" fill="#fff">停藥後惡化</text>
<circle cx="640" cy="340" r="7" fill="var(--ink,#16202b)"/>
<text class="itb-sm" x="580" y="378" text-anchor="middle">病人可能死亡，也確實死亡</text>
<text class="itb-sm" x="580" y="396" text-anchor="middle">因此不屬於不死時間</text>
<text class="itb-sm" x="8" y="424">若在停藥處設限，這個死亡事件就被移出中醫組——停藥的原因是病情變差，並非隨機。</text>

<text class="itb-sm" x="8" y="458">兩種偏差機轉不同，方向一致：都讓中醫看起來比實際更有保護力，但解法不同。</text>
</svg>
<figcaption>上為不死時間偏差，下為資訊性設限。前者靠時間相依變項或地標分析處理，後者需避免以治療中止作為設限點。</figcaption>
</figure>

## 不死時間偏差：那段期間死亡的人不會出現在中醫組

如果把「曾使用中醫」定義為暴露組，病人必須活得夠久、狀況夠穩定，才有機會走進中醫診間被記錄到。從診斷日到首次中醫就診之間那段時間，**死亡的人依定義不會被歸入中醫組**。

分析時若把這段「保證存活」的期間也算進中醫組的追蹤期，就會系統性地高估中醫的保護效果。問題出在分析設計沒有對齊時間零點，與資料本身的正確性無關。

這個偏差有多大，取決於研究怎麼定義暴露。近年不少醫院推動化療期間同步介入中醫，病人在療程一開始就進入中醫門診，診斷到首次中醫就診的間隔被壓得很短，不死時間也隨之縮小。反過來說，如果研究把暴露定義成「一年內中醫就診達六次以上」，不死時間又會被重新拉長。

處理方式是把中醫使用視為**時間相依變項（time-dependent covariate）**：病人在首次中醫就診之前算未暴露，之後才算暴露，同一個人可以在追蹤期間改變身分。另一種做法是**地標分析（landmark analysis）**：設定一個固定時點，例如診斷後三個月，以該時點的中醫使用狀態分組，並排除在此之前就死亡或失去追蹤的人。

兩種方法各有取捨。時間相依模型用掉全部資料，但詮釋較複雜；地標分析直觀，代價是捨棄早期事件，地標時點訂在哪裡也會影響結果。

## 資訊性設限：容易被誤認成不死時間的另一種情況

臨床上還有一個場景，常被誤以為也是不死時間：病人已經在接受中醫治療，中途因為併發症，西醫端擔心中藥的影響而暫停中藥，病人後來過世。

這段停藥期間**不屬於不死時間**。病人顯然可能死亡，也確實死亡了；不死時間的前提是「結果依定義不可能發生」，這裡並不成立。

真正的問題在於**中藥為什麼被停**。停藥的原因是病情變差，而非隨機發生。如果分析在停藥當下把病人設限（censor），等於把一個即將發生的死亡事件從中醫組移走，這叫**資訊性設限（informative censoring）**。腫瘤試驗中因毒性或病況惡化而提前退出的病人，造成的是同一類問題。

處理方式與前者不同：要避免把治療中止當成設限點，改採意向治療式的分析，讓病人一旦進入中醫組就持續追蹤到底；或使用**設限反機率加權（inverse probability of censoring weighting）**，依設限者的特徵回推權重，補回被移除的資訊。

實務上也可以反過來檢查：比較停藥者與持續用藥者在停藥當下的臨床特徵。如果兩群人差異明顯，設限就很可能帶有資訊。

## 讀論文時該看哪裡

| 檢查點 | 要找什麼 |
|---|---|
| 時間零點如何定義 | 是診斷日、首次治療日，還是首次中醫就診日？ |
| 暴露如何分類 | 「曾使用」還是累積次數？門檻訂在哪裡？ |
| 暴露是否隨時間變化 | 有沒有用時間相依變項或地標分析？ |
| 設限規則 | 治療中止是否被當成設限點？ |
| 敏感度分析 | 有沒有換一種暴露定義重跑？ |

方法學段落有沒有交代這幾件事，往往比結果那個風險比更值得注意。一篇誠實處理了時間零點與設限規則、效果量卻只有 0.9 的研究，可信度高於一篇沒有交代、卻報告 0.6 的研究。

## 這不是要否定中醫的價值

釐清偏差的目的，是讓真正存在的效果能被看見。當一個領域的研究普遍存在可預期的方法學問題，最先受損的是那些做得紮實的研究——它們的結論會被連帶懷疑。

觀察性資料在中醫研究裡仍然重要。台灣的健保資料庫規模與追蹤完整度在國際上少見，適合用來產生假說、描述使用樣態、偵測安全訊號。把它的限制說清楚，才知道哪些問題該留給前瞻性試驗回答。

---

延伸閱讀：〈[中西醫整合醫學到底在整合什麼？](/posts/what-is-integrative-medicine/)〉說明三種臨床運作模式，以及模式歸屬如何決定研究設計的選擇。
