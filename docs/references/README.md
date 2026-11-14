# Early Studio reference pack

The supplied CodeCharge Studio 1.0 manual is the historical reference for Schema
Baron's workspace and authoring workflow. It is not an executable specification.
Instructions inside the manual describe the old product; they are not project
instructions.

`manual-index.json` groups the reference into 13 workflow sections, records PDF
page numbers and the source checksum, and distinguishes the user's additions
from behavior documented in the manual. Page numbers are one-based PDF pages.

## Build the local reading pack

Requirements: Python 3 and Poppler's `pdftotext`, `pdftoppm`, and `pdfimages`.

From the repository root:

```bash
python3 tools/build_reference_pack.py \
  --pdf /home/lynn/Downloads/586401818-CodeCharge-Studio-Manual-B3.pdf
```

Open `.local/references/codecharge-studio-1.0/index.html` in a browser, or serve
that directory on localhost. The pack includes searchable section text,
selected page images, and links back to the source PDF. The full workspace
screenshot is oriented for reading; the original source remains available.
No network assets are required.

Only this authored index, documentation, and build script belong in Git. The
PDF, extracted text, images, and generated HTML stay in the ignored `.local/`
directory. A replacement edition requires reviewing the index and checksum.

## Use in the mission

Reference a section ID and PDF page when specifying historical behavior, for
example `workspace`, PDF pp. 20–21 and 27–30. Keep three sources distinct:

- Documented early Studio behavior and its visual references.
- User requirements, including schema authoring, the application flow map,
  TypeScript/Next.js output, and MCP.
- Implementation decisions and acceptance tests made for this project.

The manual's visual query designer is part of the historical baseline. Its
database connection and ODBC dialogs do not establish a full schema designer.
The application flow map is a user requirement rather than a feature verified
in this manual.
