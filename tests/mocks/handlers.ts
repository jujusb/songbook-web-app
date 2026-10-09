import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://api.spotify.com/v1/*', () => {
    return HttpResponse.json({});
  }),
  
  http.post('https://accounts.spotify.com/api/token', () => {
    return HttpResponse.json({ access_token: 'test-token', expires_in: 3600 });
  }),
  
  http.get('https://www.youtube.com/oembed*', () => {
    return HttpResponse.json({ title: 'Test Video', html: '<iframe></iframe>' });
  }),
  
  http.get('https://api.navidrome.org/*', () => {
    return HttpResponse.json({});
  }),
];