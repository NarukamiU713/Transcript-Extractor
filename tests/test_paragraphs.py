import json
import unittest
from godic_scraper import extract


class ParagraphTests(unittest.TestCase):
    def test_embedded_paragraphs(self):
        payload = {'subtitles': [
            {'origintext': 'Hallo.', 'paragraph': 1, 'timestamps': ['[00:01]', '[00:02]']},
            {'origintext': 'Guten Tag.', 'paragraph': 1},
            {'origintext': 'Danke.', 'paragraph': 2},
            {'origintext': 'Ende.'},
        ]}
        result = extract('var translate = ' + json.dumps(payload) + ';', 'https://example.com')
        self.assertEqual([r['paragraph'] for r in result['items']], [1, 1, 2, None])
        self.assertEqual(result['items'][0]['start'], '00:01')
        self.assertEqual(result['count'], 4)

    def test_html_paragraphs(self):
        html = '<p class="paragraph"><span class="sentence">Hallo.</span><span class="sentence">Danke.</span></p><p class="paragraph"><span class="sentence">Ende.</span></p>'
        result = extract(html, 'https://example.com')
        self.assertEqual([r['paragraph'] for r in result['items']], [1, 1, 2])
        self.assertEqual([r['german'] for r in result['items']], ['Hallo.', 'Danke.', 'Ende.'])


if __name__ == '__main__':
    unittest.main()
