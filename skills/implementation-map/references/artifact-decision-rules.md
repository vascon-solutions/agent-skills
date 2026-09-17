# Implementation Map Artifact Rules

Choose formats from the requested deliverable. Do not treat topic words or code complexity as authorization for extra artifacts.

| Requested output | Result |
| --- | --- |
| Focused explanation | Chat with file evidence; no files by default |
| Durable implementation map or review dossier | Markdown; embedded tables or Mermaid when useful |
| Browser/HTML companion | Markdown source followed by `html-artifact` |
| Static image companion or generated illustration | Markdown source followed by `image-artifact` |
| Both HTML and image | Markdown source followed by both requested companions |

"Map the PR review queue" names a target. "Create an HTML review dossier for this queue" specifies a deliverable. A visual flow request can use an embedded diagram without a separate raster image.

## Source And Destination

The Markdown map is the source for companions; code remains the authority for implementation claims. Complete the map before generating a companion. Record the requested formats and destinations in the map; after generation, record actual paths or a blocked status. Do not add an artifact-decision section to a plain map merely for ceremony.

Honor explicit output paths. Otherwise follow the companion skill's workspace defaults, reusing an existing artifact workspace when appropriate. Do not silently place generated files inside the repository merely because the source map lives there.

An unqualified request to write the source map also defaults to an artifact workspace. Use a repository destination only when the request or authorized workflow calls for repository documentation.

Invoke the installed skills with their supported arguments:

```text
html-artifact <map-path> --out <html-path>
image-artifact <map-path> --workspace <workspace> --kind <kind>
```

Useful image kinds include `architecture-diagram`, `api-flow`, and `summary-card`. Select only the kind that fits the requested visual. Check that the chosen skill is available; report unavailable generation without claiming a file was produced or expanding into unrelated setup.

## Fidelity

HTML can preserve exact paths, links, tables, and compact source excerpts. For a browser review dossier, use the applicable guidance in [review-dossier.md](review-dossier.md).

Images should contain low-text boundaries, flows, or ownership diagrams. Do not put full source files or dense inventories in images, invent components to improve the layout, or create a decorative cover without a request. Verify the derived output against the map and report created paths. Publication requires separate authorization.
