import {
  y2018, y2019, y2020, y2021, y2022, y2023, y2024, y2025, y2026, y2027,
} from '@hyunbinseo/holidays-kr/all';

// 우주항공청 월력요항(천문법에 따라 관보 게재)과 「공휴일에 관한 법률」,
// 「관공서의 공휴일에 관한 규정」을 따른다. 공공데이터포털 특일 API는 키가 필요해서
// 같은 출처를 가공한 연도별 자료를 앱에 넣는다.
const BY_DATE: Record<string, readonly string[]> = {
  ...y2018,
  ...y2019,
  ...y2020,
  ...y2021,
  ...y2022,
  ...y2023,
  ...y2024,
  ...y2025,
  ...y2026,
  ...y2027,
};

export function krHolidayNames(ymd: string): readonly string[] | null {
  return BY_DATE[ymd] ?? null;
}
