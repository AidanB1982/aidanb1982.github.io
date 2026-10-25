"""Generate a copyright-free EPUB used only by the reader smoke test."""
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED
import sys
root = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/blackwood-reading-test')
root.mkdir(parents=True, exist_ok=True)
with ZipFile(root / 'test.epub', 'w') as archive:
    archive.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
    archive.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    archive.writestr('book.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">reader-test</dc:identifier><dc:title>Test Edition</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-25T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>')
    archive.writestr('nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">The First Chapter</a></li><li><a href="two.xhtml">The Second Chapter</a></li></ol></nav></body></html>')
    for name, title in [('one', 'The First Chapter'), ('two', 'The Second Chapter')]:
        paragraph = '<p>Beyond the trees, the light settled on the water. This is a test paragraph for the Blackwood reading room, where every page should feel calm and clear.</p>'
        hostile = '<style>p,h1{color:#eee0c5!important;background-color:#eee0c5!important;font-family:UnusablePublisherFont!important}</style>' if '--publisher-colours' in sys.argv else ''
        archive.writestr(name + '.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head>' + hostile + '<title>' + title + '</title></head><body><h1>' + title + '</h1>' + paragraph * 65 + '</body></html>')
