"""Exercise the extraction service with mocked HTTP/DNS, without network or secrets."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail

class App:
    def get(self, *args): return lambda fn: fn
    def post(self, *args): return lambda fn: fn

sys.modules['fastapi'] = types.SimpleNamespace(FastAPI=App, Header=lambda **kw: None, HTTPException=HTTPException)
sys.modules['pydantic'] = types.SimpleNamespace(BaseModel=object)
sys.modules['scrapling.fetchers'] = types.SimpleNamespace(Fetcher=types.SimpleNamespace(get=None))
spec = importlib.util.spec_from_file_location('scrapling_service', Path(__file__).parents[1] / 'scrapling.py')
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)

class Selection:
    def get(self): return 'Company'
    def getall(self): return ['/team', '/team', '/products']

class Page:
    status = 200
    url = 'https://company.se/'
    headers = {}
    def css(self, selector): return Selection()
    def get_all_text(self, **kw): return 'Industrial manufacturing and management team. ' * 8

class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.auth = patch.dict(service.os.environ, {'SCRAPLING_SERVICE_TOKEN': 'test'})
        self.auth.start()
        self.dns = patch.object(service.socket, 'getaddrinfo', return_value=[(None,None,None,None,('93.184.216.34',443))])
        self.dns.start()
    def tearDown(self): self.dns.stop(); self.auth.stop()
    def extract(self): return service.scrape(types.SimpleNamespace(url='https://company.se/'), 'Bearer test')
    def test_success_preserves_links_and_bounds_timeout(self):
        with patch.object(service.Fetcher, 'get', return_value=Page()) as fetch:
            result = self.extract()
            self.assertEqual(result['data']['links'], ['https://company.se/team','https://company.se/products'])
            self.assertEqual(result['data']['metadata']['source'], 'scrapling-fallback')
            self.assertEqual(fetch.call_args.kwargs['timeout'], 25)
            self.assertFalse(fetch.call_args.kwargs['allow_redirects'])
    def test_missing_token_fails_closed(self):
        with patch.dict(service.os.environ, {'SCRAPLING_SERVICE_TOKEN': ''}):
            self.assertFalse(service._authorized(None))
    def test_error_and_blocker_are_not_evidence(self):
        for status, text in [(403, 'Forbidden'), (200, 'Verify you are human. ' * 8)]:
            page = Page(); page.status=status; page.get_all_text=lambda **kw: text
            with patch.object(service.Fetcher, 'get', return_value=page), self.assertRaises(HTTPException): self.extract()
    def test_redirect_to_private_host_rejected_before_second_fetch(self):
        page=Page(); page.status=302; page.headers={'location':'http://localhost/admin'}
        with patch.object(service.Fetcher, 'get', return_value=page) as fetch:
            with self.assertRaises(HTTPException): self.extract()
            self.assertEqual(fetch.call_count, 1)
            # DNS simulation must still return a private address for the redirected host.

if __name__ == '__main__': unittest.main()
