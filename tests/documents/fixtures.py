"""Stage 2 / Slice 2 -- real document fixture builders.

Per Step 13's instruction ("Do not introduce a runtime PDF-generation
dependency merely for tests unless already present as a dev
dependency... A small static binary test fixture is acceptable if
necessary"), every fixture here is built from scratch using only
Python's standard library (``zipfile`` for the three OOXML formats;
raw byte assembly for PDF) -- no ``fpdf2``/``python-docx``/
``openpyxl``/``python-pptx`` dependency is introduced for tests.

Every fixture below was verified during Slice 2 implementation to
round-trip correctly through the actually-installed ``markitdown``
0.1.7 + ``magika`` 0.6.3 (real conversion succeeds, real Magika
detects the correct label at high confidence) -- these are not
guessed-at minimal structures, they are confirmed-working ones.
"""

from __future__ import annotations

import io
import zipfile

# ---------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------


def build_minimal_pdf(text: str = "TorqPro test document") -> bytes:
    """A minimal, real, single-page PDF containing ``text`` as an
    actual extractable content stream (not just a ``%PDF-`` header on
    garbage bytes) -- confirmed via real MarkItDown/pdfminer
    conversion during Slice 2 implementation."""
    content_stream = f"BT /F1 24 Tf 72 712 Td ({text}) Tj ET".encode("latin-1")

    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        (
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> "
            b"/MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n"
        ),
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        (
            b"5 0 obj\n<< /Length " + str(len(content_stream)).encode() + b" >>\nstream\n"
            + content_stream + b"\nendstream\nendobj\n"
        ),
    ]

    buf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(buf))
        buf += obj

    xref_offset = len(buf)
    n = len(objects) + 1
    xref = f"xref\n0 {n}\n0000000000 65535 f \n".encode()
    for off in offsets[1:]:
        xref += f"{off:010d} 00000 n \n".encode()
    buf += xref
    buf += f"trailer\n<< /Size {n} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode()
    return bytes(buf)


# ---------------------------------------------------------------------
# DOCX
# ---------------------------------------------------------------------

_DOCX_CONTENT_TYPES = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

_DOCX_RELS = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def build_minimal_docx(
    heading: str = "TorqPro Test Belgesi",
    paragraph: str = "T\u00fcrk\u00e7e karakter testi: g\u00f6vde, c\u0131vata, s\u0131k\u0131\u015ftırma, de\u011fer, \u0130\u011e\u00dc\u015e\u00d6\u00c7 \u00f6l\u00e7\u00fcm",
    include_table: bool = True,
) -> bytes:
    """A minimal, real, structurally-valid DOCX with a heading
    paragraph, a Turkish-character paragraph, and (optionally) a
    2x2 table -- confirmed via real MarkItDown/mammoth conversion
    during Slice 2 implementation, including full Turkish-diacritic
    fidelity."""
    table_xml = ""
    if include_table:
        table_xml = (
            "<w:tbl>"
            "<w:tr><w:tc><w:p><w:r><w:t>C\u0131vata</w:t></w:r></w:p></w:tc>"
            "<w:tc><w:p><w:r><w:t>M12</w:t></w:r></w:p></w:tc></w:tr>"
            "<w:tr><w:tc><w:p><w:r><w:t>Tork</w:t></w:r></w:p></w:tc>"
            "<w:tc><w:p><w:r><w:t>85 Nm</w:t></w:r></w:p></w:tc></w:tr>"
            "</w:tbl>"
        )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        f"<w:p><w:r><w:t>{heading}</w:t></w:r></w:p>"
        f"<w:p><w:r><w:t>{paragraph}</w:t></w:r></w:p>"
        f"{table_xml}"
        "</w:body></w:document>"
    ).encode("utf-8")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _DOCX_CONTENT_TYPES)
        z.writestr("_rels/.rels", _DOCX_RELS)
        z.writestr("word/document.xml", document_xml)
    return buf.getvalue()


# ---------------------------------------------------------------------
# XLSX
# ---------------------------------------------------------------------

_XLSX_CONTENT_TYPES = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""

_XLSX_RELS = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

_XLSX_WORKBOOK_RELS = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>"""

_XLSX_WORKBOOK_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Veri" sheetId="1" r:id="rId1"/>
    <sheet name="Bos" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>""".encode("utf-8")

_XLSX_SHEET1_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>C\u0131vata</t></is></c><c r="B1" t="inlineStr"><is><t>Tork(Nm)</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>M12</t></is></c><c r="B2"><v>85</v></c></row>
  </sheetData>
</worksheet>""".encode("utf-8")

_XLSX_SHEET2_EMPTY_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData/>
</worksheet>""".encode("utf-8")


def build_minimal_xlsx() -> bytes:
    """A minimal, real, structurally-valid two-sheet XLSX ("Veri"
    with Turkish-labeled data, "Bos" deliberately empty) -- confirmed
    via real MarkItDown/openpyxl conversion during Slice 2
    implementation to represent both sheets, including the empty
    one, matching Stage 1's finding."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _XLSX_CONTENT_TYPES)
        z.writestr("_rels/.rels", _XLSX_RELS)
        z.writestr("xl/workbook.xml", _XLSX_WORKBOOK_XML)
        z.writestr("xl/_rels/workbook.xml.rels", _XLSX_WORKBOOK_RELS)
        z.writestr("xl/worksheets/sheet1.xml", _XLSX_SHEET1_XML)
        z.writestr("xl/worksheets/sheet2.xml", _XLSX_SHEET2_EMPTY_XML)
    return buf.getvalue()


# ---------------------------------------------------------------------
# PPTX
# ---------------------------------------------------------------------

_PPTX_CONTENT_TYPES = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>"""

_PPTX_RELS = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""

_PPTX_PRES_RELS = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>"""

_PPTX_PRESENTATION_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
  </p:sldIdLst>
</p:presentation>""".encode("utf-8")

_PPTX_BLANK_SLIDE_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
</p:sld>""".encode("utf-8")


def _pptx_text_slide_xml(text: str) -> bytes:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        "<p:cSld><p:spTree>"
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        "<p:grpSpPr/>"
        "<p:sp>"
        '<p:nvSpPr><p:cNvPr id="2" name="TextBox 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        "<p:spPr>"
        '<a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        "</p:spPr>"
        f"<p:txBody><a:bodyPr/><a:p><a:r><a:t>{text}</a:t></a:r></a:p></p:txBody>"
        "</p:sp>"
        "</p:spTree></p:cSld></p:sld>"
    ).encode("utf-8")


def build_minimal_pptx(text: str = "TorqPro Sunum: s\u0131k\u0131\u015ftırma testi") -> bytes:
    """A minimal, real, structurally-valid two-slide PPTX (slide 1
    has a Turkish-text textbox, slide 2 is deliberately blank/
    no-text) -- confirmed via real MarkItDown/python-pptx conversion
    during Slice 2 implementation, including slide-number markers
    and graceful blank-slide handling."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _PPTX_CONTENT_TYPES)
        z.writestr("_rels/.rels", _PPTX_RELS)
        z.writestr("ppt/presentation.xml", _PPTX_PRESENTATION_XML)
        z.writestr("ppt/_rels/presentation.xml.rels", _PPTX_PRES_RELS)
        z.writestr("ppt/slides/slide1.xml", _pptx_text_slide_xml(text))
        z.writestr("ppt/slides/slide2.xml", _PPTX_BLANK_SLIDE_XML)
    return buf.getvalue()


# ---------------------------------------------------------------------
# Generic (non-OOXML) ZIP -- the "renamed archive" attack case
# ---------------------------------------------------------------------


def build_generic_zip() -> bytes:
    """A legitimate ZIP archive with no OOXML structure at all --
    used to build the "renamed generic ZIP" fixtures for
    .docx/.xlsx/.pptx mismatch tests."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("hello.txt", "hello")
    return buf.getvalue()


# ---------------------------------------------------------------------
# Scanned / image-only PDF (Stage 2 / Slice 6 -- OCR fallback fixtures)
# ---------------------------------------------------------------------

_SCANNED_PAGE_LINES = [
    "TorqPro Engineering Document",
    "Bolted joint torque specification report",
    "T\u00fcrk\u00e7e karakter testi: g\u00f6vde, c\u0131vata, s\u0131k\u0131\u015ftırma",
    "\u0130\u011e\u00dc\u015e\u00d6\u00c7 \u0131\u011f\u00fc\u015f\u00f6\u00e7 \u00f6l\u00e7\u00fcm \u015fartname de\u011feri",
]

_DEJAVU_SANS_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def build_scanned_pdf(page_count: int = 1, lines=None) -> bytes:
    """A real, structurally-valid PDF containing only rendered page
    images (no text layer at all) -- confirmed during Slice 6
    implementation to: (a) pass content_validation's real Magika +
    structural checks as a genuine PDF, (b) produce
    EmptyExtractionError through the real MarkItDown converter (no
    extractable text layer for MarkItDown to find), and (c) produce
    real, meaningful OCR text (including correctly-recognized Turkish
    characters) through the real Tesseract engine via
    ocr_adapter.ocr_pdf().

    Requires the DejaVu Sans TTF font to be present (used only to
    *render* the page image via Pillow -- this is a test-fixture
    concern, unrelated to backend.documents.ocr_adapter, which never
    renders text itself, only PDF pages). If the font is unavailable,
    callers should skip rather than fail -- see
    ``dejavu_font_available()``.
    """
    from PIL import Image, ImageDraw, ImageFont
    import pymupdf

    if lines is None:
        lines = _SCANNED_PAGE_LINES
    font = ImageFont.truetype(_DEJAVU_SANS_PATH, 28)

    doc = pymupdf.open()
    for _ in range(page_count):
        img = Image.new("RGB", (1600, 500), "white")
        draw = ImageDraw.Draw(img)
        y = 40
        for line in lines:
            draw.text((40, y), line, fill="black", font=font)
            y += 80
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        page = doc.new_page(width=1600, height=500)
        rect = pymupdf.Rect(0, 0, 1600, 500)
        page.insert_image(rect, stream=buf.getvalue())

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def build_blank_scanned_pdf(page_count: int = 1) -> bytes:
    """A structurally-valid, image-only PDF whose page image is
    entirely blank (no rendered text at all) -- used to test the OCR
    meaningful-text threshold (Step 5): real OCR against this fixture
    should recognize nothing, and the empty/near-empty result must be
    rejected as OCREmptyExtractionError rather than accepted."""
    from PIL import Image
    import pymupdf

    doc = pymupdf.open()
    for _ in range(page_count):
        img = Image.new("RGB", (800, 400), "white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        page = doc.new_page(width=800, height=400)
        rect = pymupdf.Rect(0, 0, 800, 400)
        page.insert_image(rect, stream=buf.getvalue())
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def dejavu_font_available() -> bool:
    import os

    return os.path.exists(_DEJAVU_SANS_PATH)
