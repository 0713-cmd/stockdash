// /api/screen 결과를 여러 컴포넌트가 공유하는 클라이언트 캐시 (중복 호출 방지)
let cache = null;
let promise = null;

export function getScreen() {
  if (cache) return Promise.resolve(cache);
  if (!promise) {
    promise = fetch('/api/screen')
      .then(r => r.json())
      .then(d => { cache = d; return d; })
      .catch(e => { promise = null; throw e; });
  }
  return promise;
}
