import threading
import unittest
from urllib.request import urlopen
from http.server import ThreadingHTTPServer
from app import Handler, HERE


class StaticAssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:%s" % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_nlp_asset_is_served(self):
        with urlopen(self.base + "/transcript_nlp.js", timeout=5) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers.get_content_type(), "application/javascript")
            self.assertEqual(response.read(), (HERE / "transcript_nlp.js").read_bytes())

    def test_page_loads_relative_nlp_asset_before_app(self):
        with urlopen(self.base + "/", timeout=5) as response:
            html = response.read().decode("utf-8")
        asset = '<script src="transcript_nlp.js"></script>'
        self.assertIn(asset, html)
        self.assertLess(html.index(asset), html.index("<script>"))


if __name__ == "__main__":
    unittest.main()
