# OCR 최적화: Azure CV → Gemini Vision 직접 분석

## 현재 구조

```
이미지 → Cloudflare Worker → Azure CV (OCR) → 텍스트 파싱 → 클라이언트
                                                    ↓
                                            Gemini (AI 보정)
```

### 문제점

1. **비용**: Azure CV API 호출 비용이 전체 비용의 87% 차지
2. **속도**: 비동기 폴링 방식으로 3-8초 소요 (1초 간격 최대 30회 폴링)
3. **복잡도**: Worker에서 텍스트 파싱 로직 유지 필요
4. **이중 처리**: OCR → AI 보정으로 2단계 처리

## 제안 구조

```
이미지 → Gemini Vision (직접 분석) → 구조화된 JSON
```

### 장점

1. **비용 절감**: 6.7배 저렴
2. **속도 개선**: 폴링 제거로 2-5초 예상
3. **단순화**: Worker 파싱 로직 제거 가능
4. **정확도**: 이미지 컨텍스트 직접 이해 (표, 레이아웃 등)

## 비용 비교 (이미지 4장 기준)

| 방식                      | 1회 비용 | 월 10,000회 | 연간     |
| ------------------------- | -------- | ----------- | -------- |
| **현재 (Azure + Gemini)** | $0.00404 | $40.4       | $485     |
| **Gemini Vision 직접**    | $0.0006  | $6.0        | $72      |
| **절감액**                | -        | $34.4       | **$413** |

### 상세 비용 산출

#### 현재 방식 (Azure CV + Gemini AI)

- Azure CV Read API: $1.00 / 1,000건 → 4장 = $0.004
- Gemini Flash-Lite (텍스트 보정): ~350 토큰 = $0.00004
- **합계: $0.00404 / 회**

#### Gemini Vision 직접

- Gemini Flash-Lite (이미지 직접): ~2,000 토큰/장 × 4장 = $0.0006
- **합계: $0.0006 / 회**

## 속도 비교

| 방식          | 예상 속도 | 병목                   |
| ------------- | --------- | ---------------------- |
| Azure CV      | 3-8초     | 비동기 폴링 (1초 간격) |
| Gemini Vision | 2-5초     | 단일 API 호출          |

### Azure CV 폴링 코드 (현재)

```typescript
while (attempts < maxAttempts) {
  await new Promise((r) => setTimeout(r, 1000)); // 1초 대기
  const result = await fetch(operationLocation, ...);
  if (result.status === 'succeeded') break;
  attempts++;
}
```

## 크레딧 가격 설정 (Gemini Vision 기준)

| 크레딧 팩 | 판매가  | 원가  | 마진    | 마진율 |
| --------- | ------- | ----- | ------- | ------ |
| 10회      | 1,000원 | 8원   | 992원   | 99%    |
| 50회      | 3,000원 | 40원  | 2,960원 | 98%    |
| 200회     | 9,000원 | 160원 | 8,840원 | 98%    |

## 구현 계획

### Phase 1: 검증

- [ ] Gemini Vision 직접 분석 프로토타입
- [ ] 동일 이미지로 속도/정확도 비교
- [ ] 토큰 사용량 실측

### Phase 2: 전환

- [ ] 클라이언트에서 직접 Gemini API 호출
- [ ] Worker OCR 엔드포인트 deprecate
- [ ] 프롬프트 최적화

### Phase 3: 수익화

- [ ] 크레딧 시스템 구현
- [ ] 결제 연동

## 검증 항목

| 항목   | 측정 방법             | 목표                     |
| ------ | --------------------- | ------------------------ |
| 속도   | 동일 이미지 10회 평균 | Azure 대비 30% 이상 개선 |
| 비용   | 토큰 사용량 실측      | 1회당 $0.001 이하        |
| 정확도 | 상품 추출 개수/정확도 | Azure+AI 대비 동등 이상  |

## 리스크

1. **Gemini Vision 한글 인식률**: 테스트 필요
2. **이미지 크기 제한**: 큰 이미지는 리사이즈 필요 가능
3. **Rate Limit**: 무료 티어 분당 10회 제한

## 참고

- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Azure CV Pricing](https://azure.microsoft.com/pricing/details/cognitive-services/computer-vision/)
- Gemini Flash-Lite: Input $0.075/1M tokens, Output $0.30/1M tokens
