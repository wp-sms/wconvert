# Move a design between sites

Import and export are available in Free. A design that uses paid features still
needs the matching plan on the receiving site.

## Find the actions

Open a campaign in the editor. Select the **three-dot button** beside
**Review & publish** in the top toolbar. Its accessible name is **Campaign
actions**. Choose **Export design** or **Import design**.

## Export

1. Choose **Export design** and check the preview and included content.
2. Select **Download design** to save a `.wconvert.zip` file. The file includes
   your current design, including unsaved edits.
3. If some images cannot be included, review the list. Fix those images in the
   editor, or explicitly choose **Export without these images**.

Supported local PNG, JPEG and WebP images travel inside the file. For example, a
local product photo will still work after importing into another site. Built-in
illustrations require the same illustration to be available on the receiving
site. Remote-only images, uploaded SVGs, font files and linked documents are not
embedded. A link to a PDF remains a link; the PDF itself does not move.

The file contains the design, wording, links and supported images. It does not
back up campaign settings, connected services, leads, statistics or history.

## Import and review

1. Open the campaign that should receive the design and choose **Import design**.
2. Choose the `.wconvert.zip` file and review the desktop and mobile previews.
3. Leave **Use file content** selected to copy the file's wording and images.
   Alternatively, choose **Keep my current content** to fit your campaign's
   content into matching places in the imported design. Unmatched content can
   be lost, so check every screen.
4. Review the links. For example, change `oldshop.example/sale` to your new sale
   page, or explicitly keep the original address. WConvert does not guess a new
   domain. After editing links, update the preview before applying.
5. Read any notices about missing illustrations, placement, privacy wording or
   form destinations. Confirm the reviewed changes when prompted, then select
   **Apply to draft**.
6. Check the campaign's display rules and destinations. Use **Save draft** to
   keep the changes, or **Review & publish** when ready to publish.

Applying an import does not save or publish the campaign. **Undo draft edit**
reverses the design change in one step. Imported images become normal Media
Library items and remain available after Undo or discarding the draft.

## If an import cannot continue

| Message or situation | What to do |
| --- | --- |
| File exceeds the upload limit | Use a smaller design file. The maximum is 25 MiB; your host may allow less. |
| Image is too large | Resize or compress it before exporting: up to 5 MiB and 4096 pixels per dimension, with at most 16 unique images and 20 MiB total. |
| Image type or upload permission refused | Ask the site administrator to check allowed image types and your Media Library upload permission. |
| Not enough upload space | Free space on the receiving multisite site or ask its network administrator to increase the quota. |
| Import expired or was replaced | Choose the file again. Previews expire after 30 minutes; a new import replaces your previous import on that site. |
| Required paid feature unavailable | Use the matching plan, or export a design that uses features available on the receiving site. |
| Temporary storage or ZIP support unavailable | Ask the host to enable PHP ZIP support and provide writable private temporary storage outside the web directory. |
| Image import or progress saving failed | Resolve the storage/upload problem and retry. Handled failures remove newly created images; retrying a completed import does not duplicate them. |

Cancel leaves the campaign unchanged. Files from unsupported versions or with
invalid contents are refused; export a fresh file from a compatible WConvert
installation.
