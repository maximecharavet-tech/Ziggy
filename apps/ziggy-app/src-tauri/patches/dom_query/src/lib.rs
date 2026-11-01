//! MIT drop-in for the part of `dom_query` 0.28 used in a Tauri app (no MPL-2.0 CSS parser):
//!
//! - `wry` on Android prepends `<script>` elements to the `<head>` of a bundled page, on
//!   WebViews too old for document-start scripts;
//! - `tauri-codegen` (build time) reads and tags the bundled pages for the CSP: it selects
//!   `script[src^='http']`, `style`, `script[src]` and `script:not(:empty)`, reads or sets
//!   attributes and text, and may add a `<meta>` to `<head>`.
//!
//! The page is not rebuilt: it is kept byte for byte, and only the touched start tags, texts
//! and the inserted elements are written into it. Supported selectors: `tag`, `tag[attr]`,
//! `tag[attr^='value']`, `tag:not(:empty)` (what the callers above use).

use std::cell::RefCell;
use std::fmt;

#[derive(Debug, Clone)]
struct Attr {
    name: String,
    value: Option<String>,
}

#[derive(Debug, Clone)]
enum Kind {
    /// The page itself (or its `<html>` start tag when it has one).
    Root { start_end: Option<usize> },
    /// An element of the page: its start tag spans `start..start_end`, its content
    /// `start_end..content_end` (raw text elements: script, style...).
    Found { start: usize, start_end: usize, content_end: usize },
    /// An element created through the API.
    New,
}

#[derive(Debug, Clone)]
struct Node {
    kind: Kind,
    name: String,
    attrs: Vec<Attr>,
    dirty_attrs: bool,
    text: Option<String>,
    prepended: Vec<usize>,
    appended: Vec<usize>,
}

/// The elements of a document.
#[derive(Debug, Default)]
pub struct Tree {
    nodes: RefCell<Vec<Node>>,
}

impl Tree {
    fn add(&self, node: Node) -> usize {
        let mut nodes = self.nodes.borrow_mut();
        nodes.push(node);
        nodes.len() - 1
    }

    /// A new element, not yet in the document.
    pub fn new_element(&self, name: &str) -> NodeRef<'_> {
        let id = self.add(Node {
            kind: Kind::New,
            name: name.to_ascii_lowercase(),
            attrs: Vec::new(),
            dirty_attrs: false,
            text: None,
            prepended: Vec::new(),
            appended: Vec::new(),
        });
        NodeRef { tree: self, id }
    }

    fn start_tag(node: &Node) -> String {
        let mut out = format!("<{}", node.name);
        for attr in &node.attrs {
            out.push(' ');
            out.push_str(&attr.name);
            if let Some(value) = &attr.value {
                out.push_str("=\"");
                out.push_str(&value.replace('&', "&amp;").replace('"', "&quot;"));
                out.push('"');
            }
        }
        out.push('>');
        out
    }

    fn render_list(&self, ids: &[usize], out: &mut String) {
        for &id in ids {
            self.render_new(id, out);
        }
    }

    fn render_new(&self, id: usize, out: &mut String) {
        let node = self.nodes.borrow()[id].clone();
        out.push_str(&Self::start_tag(&node));
        self.render_list(&node.prepended, out);
        if let Some(text) = &node.text {
            out.push_str(text);
        }
        self.render_list(&node.appended, out);
        if !matches!(node.name.as_str(), "meta" | "link" | "br" | "img" | "input" | "hr") {
            out.push_str("</");
            out.push_str(&node.name);
            out.push('>');
        }
    }
}

/// An element of the document.
#[derive(Clone, Copy)]
pub struct NodeRef<'a> {
    tree: &'a Tree,
    id: usize,
}

impl fmt::Debug for NodeRef<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "NodeRef({})", self.id)
    }
}

impl<'a> NodeRef<'a> {
    /// Makes `child` the first child of this element.
    pub fn prepend_child(&self, child: &NodeRef) {
        self.tree.nodes.borrow_mut()[self.id].prepended.insert(0, child.id);
    }

    /// Makes `child` the last child of this element.
    pub fn append_child(&self, child: &NodeRef) {
        self.tree.nodes.borrow_mut()[self.id].appended.push(child.id);
    }

    /// Replaces the element's text (written as is, like the content of a `<script>`).
    pub fn set_text<T: Into<String>>(&self, text: T) {
        self.tree.nodes.borrow_mut()[self.id].text = Some(text.into());
    }

    /// The value of an attribute.
    pub fn attr(&self, name: &str) -> Option<String> {
        let nodes = self.tree.nodes.borrow();
        nodes[self.id]
            .attrs
            .iter()
            .find(|a| a.name.eq_ignore_ascii_case(name))
            .map(|a| a.value.clone().unwrap_or_default())
    }

    /// Sets an attribute (added at the end when new).
    pub fn set_attr(&self, name: &str, value: &str) {
        let mut nodes = self.tree.nodes.borrow_mut();
        let node = &mut nodes[self.id];
        node.dirty_attrs = true;
        match node.attrs.iter_mut().find(|a| a.name.eq_ignore_ascii_case(name)) {
            Some(attr) => attr.value = Some(value.to_owned()),
            None => node.attrs.push(Attr { name: name.to_ascii_lowercase(), value: Some(value.to_owned()) }),
        }
    }

    /// Removes an attribute.
    pub fn remove_attr(&self, name: &str) {
        let mut nodes = self.tree.nodes.borrow_mut();
        let node = &mut nodes[self.id];
        node.dirty_attrs = true;
        node.attrs.retain(|a| !a.name.eq_ignore_ascii_case(name));
    }

    /// The element's text.
    pub fn text(&self) -> String {
        self.tree.nodes.borrow()[self.id].text.clone().unwrap_or_default()
    }
}

/// Elements matched by `Document::select`.
pub struct Selection<'a> {
    nodes: Vec<NodeRef<'a>>,
}

impl<'a> Selection<'a> {
    pub fn nodes(&self) -> &[NodeRef<'a>] {
        &self.nodes
    }

    pub fn iter(&self) -> impl Iterator<Item = NodeRef<'a>> + '_ {
        self.nodes.iter().copied()
    }

    pub fn length(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }
}

/// An HTML page.
pub struct Document {
    source: String,
    pub tree: Tree,
    root: usize,
    head: Option<usize>,
    found: Vec<usize>,
}

const RAW_TEXT: [&str; 4] = ["script", "style", "title", "textarea"];

fn parse_attrs(tag: &str) -> Vec<Attr> {
    // `tag` is the inside of a start tag, after the name: ` a="1" b c='2'`.
    let bytes = tag.as_bytes();
    let mut attrs = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        while i < bytes.len() && (bytes[i].is_ascii_whitespace() || bytes[i] == b'/') {
            i += 1;
        }
        let start = i;
        while i < bytes.len() && !bytes[i].is_ascii_whitespace() && bytes[i] != b'=' && bytes[i] != b'/' {
            i += 1;
        }
        if start == i {
            break;
        }
        let name = tag[start..i].to_ascii_lowercase();
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        let mut value = None;
        if i < bytes.len() && bytes[i] == b'=' {
            i += 1;
            while i < bytes.len() && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            if i < bytes.len() && (bytes[i] == b'"' || bytes[i] == b'\'') {
                let quote = bytes[i];
                let from = i + 1;
                let to = tag[from..].find(quote as char).map_or(tag.len(), |e| from + e);
                value = Some(tag[from..to].replace("&quot;", "\"").replace("&amp;", "&"));
                i = (to + 1).min(tag.len());
            } else {
                let from = i;
                while i < bytes.len() && !bytes[i].is_ascii_whitespace() {
                    i += 1;
                }
                value = Some(tag[from..i].to_owned());
            }
        }
        attrs.push(Attr { name, value });
    }
    attrs
}

impl Document {
    fn parse(html: &str) -> Self {
        let tree = Tree::default();
        let lower = html.to_ascii_lowercase();
        let mut found = Vec::new();
        let mut root_start_end = None;
        let mut head = None;
        let mut i = 0;
        while let Some(at) = lower[i..].find('<').map(|p| i + p) {
            let rest = &lower[at + 1..];
            if rest.starts_with("!--") {
                i = lower[at..].find("-->").map_or(lower.len(), |e| at + e + 3);
                continue;
            }
            let name_len = rest.bytes().take_while(|b| b.is_ascii_alphanumeric() || *b == b'-').count();
            if name_len == 0 || !rest.as_bytes()[0].is_ascii_alphabetic() {
                i = at + 1;
                continue;
            }
            let name = &rest[..name_len];
            let Some(start_end) = lower[at..].find('>').map(|e| at + e + 1) else { break };
            let attrs_src = &html[at + 1 + name_len..start_end - 1];
            let content_end = if RAW_TEXT.contains(&name) {
                lower[start_end..].find(&format!("</{name}")).map_or(lower.len(), |e| start_end + e)
            } else {
                start_end
            };
            if name == "html" && root_start_end.is_none() {
                root_start_end = Some(start_end);
            } else {
                let id = tree.add(Node {
                    kind: Kind::Found { start: at, start_end, content_end },
                    name: name.to_owned(),
                    attrs: parse_attrs(attrs_src),
                    dirty_attrs: false,
                    text: RAW_TEXT.contains(&name).then(|| html[start_end..content_end].to_owned()),
                    prepended: Vec::new(),
                    appended: Vec::new(),
                });
                if name == "head" && head.is_none() {
                    head = Some(id);
                }
                found.push(id);
            }
            i = content_end.max(start_end);
        }
        let root = tree.add(Node {
            kind: Kind::Root { start_end: root_start_end },
            name: "html".into(),
            attrs: Vec::new(),
            dirty_attrs: false,
            text: None,
            prepended: Vec::new(),
            appended: Vec::new(),
        });
        Self { source: html.to_owned(), tree, root, head, found }
    }

    /// The page's `<head>`, when it has one.
    pub fn head(&self) -> Option<NodeRef<'_>> {
        self.head.map(|id| NodeRef { tree: &self.tree, id })
    }

    /// The page's `<html>` element.
    pub fn html_root(&self) -> NodeRef<'_> {
        NodeRef { tree: &self.tree, id: self.root }
    }

    /// Elements of the page matching a simple selector (see the crate documentation).
    pub fn select(&self, selector: &str) -> Selection<'_> {
        let selector = selector.trim();
        let not_empty = selector.ends_with(":not(:empty)");
        let selector = selector.trim_end_matches(":not(:empty)");
        let (tag, condition) = match selector.find('[') {
            Some(at) => (&selector[..at], Some(selector[at + 1..].trim_end_matches(']'))),
            None => (selector, None),
        };
        let (attr, prefix) = match condition {
            Some(cond) => match cond.split_once("^=") {
                Some((name, value)) => (Some(name.trim()), Some(value.trim().trim_matches(|c| c == '\'' || c == '"'))),
                None => (Some(cond.trim()), None),
            },
            None => (None, None),
        };
        let nodes = self.tree.nodes.borrow();
        let matches = self
            .found
            .iter()
            .copied()
            .filter(|&id| {
                let node = &nodes[id];
                if !node.name.eq_ignore_ascii_case(tag) {
                    return false;
                }
                if not_empty && node.text.as_deref().unwrap_or("").is_empty() {
                    return false;
                }
                match (attr, prefix) {
                    (None, _) => true,
                    (Some(name), None) => node.attrs.iter().any(|a| a.name.eq_ignore_ascii_case(name)),
                    (Some(name), Some(prefix)) => node.attrs.iter().any(|a| {
                        a.name.eq_ignore_ascii_case(name) && a.value.as_deref().unwrap_or("").starts_with(prefix)
                    }),
                }
            })
            .map(|id| NodeRef { tree: &self.tree, id })
            .collect();
        Selection { nodes: matches }
    }

    /// The page with every change written into it.
    pub fn html(&self) -> String {
        let nodes = self.tree.nodes.borrow().clone();
        // (position, priority, text): insertions and replacements, applied from the end.
        let mut edits: Vec<(usize, usize, String)> = Vec::new();
        let source = &self.source;
        for &id in &self.found {
            let node = &nodes[id];
            let Kind::Found { start, start_end, content_end } = node.kind else { continue };
            let mut piece = String::new();
            let original_text = &source[start_end..content_end];
            let text_changed = node.text.as_deref().is_some_and(|t| t != original_text);
            if !node.dirty_attrs && !text_changed && node.prepended.is_empty() && node.appended.is_empty() {
                continue;
            }
            piece.push_str(&if node.dirty_attrs { Tree::start_tag(node) } else { source[start..start_end].to_owned() });
            self.tree.render_list(&node.prepended, &mut piece);
            piece.push_str(if text_changed { node.text.as_deref().unwrap_or("") } else { original_text });
            let mut tail = String::new();
            self.tree.render_list(&node.appended, &mut tail);
            if node.appended.is_empty() || content_end != start_end {
                piece.push_str(&tail);
                edits.push((start, content_end, piece));
            } else {
                // A normal element: its end tag is further away; append before it.
                edits.push((start, content_end, piece));
                let close = source[start_end..]
                    .to_ascii_lowercase()
                    .find(&format!("</{}", node.name))
                    .map_or(source.len(), |e| start_end + e);
                edits.push((close, close, tail));
            }
        }
        let root = &nodes[self.root];
        let mut prefix = String::new();
        self.tree.render_list(&root.prepended, &mut prefix);
        let at = match root.kind {
            Kind::Root { start_end } => start_end.unwrap_or(0),
            _ => 0,
        };
        edits.push((at, at, prefix));
        let mut suffix = String::new();
        self.tree.render_list(&root.appended, &mut suffix);
        edits.push((source.len(), source.len(), suffix));

        edits.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
        let mut page = source.clone();
        for (from, to, text) in edits {
            page.replace_range(from..to, &text);
        }
        page
    }
}

impl From<&str> for Document {
    fn from(html: &str) -> Self {
        Self::parse(html)
    }
}

impl From<String> for Document {
    fn from(html: String) -> Self {
        Self::parse(&html)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The calls of wry's `inject_scripts_into_html`.
    fn inject(html: &str, scripts: &[&str]) -> String {
        let document = Document::from(html);
        let head = document.head().unwrap_or_else(|| {
            let root = document.html_root();
            let head = document.tree.new_element("head");
            root.prepend_child(&head);
            head
        });
        for script in scripts.iter().rev() {
            let tag = document.tree.new_element("script");
            tag.set_text(*script);
            head.prepend_child(&tag);
        }
        document.html()
    }

    #[test]
    fn scripts_go_first_in_head_in_order() {
        let page = "<!doctype html><html lang=\"fr\"><HEAD><meta charset=\"utf-8\"></HEAD><body>x</body></html>";
        assert_eq!(
            inject(page, &["a()", "b()"]),
            "<!doctype html><html lang=\"fr\"><HEAD><script>a()</script><script>b()</script><meta charset=\"utf-8\"></HEAD><body>x</body></html>"
        );
    }

    #[test]
    fn a_head_is_created_when_missing() {
        assert_eq!(
            inject("<html><body>x</body></html>", &["a()"]),
            "<html><head><script>a()</script></head><body>x</body></html>"
        );
        assert_eq!(inject("<p>x</p>", &["a()"]), "<head><script>a()</script></head><p>x</p>");
        assert_eq!(
            inject("<html><body><header>t</header></body></html>", &["a()"]),
            "<html><head><script>a()</script></head><body><header>t</header></body></html>"
        );
    }

    #[test]
    fn unchanged_pages_round_trip() {
        for page in [
            "<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>",
            "<!DOCTYPE html><html><head></head><body></body></html>",
            "<!-- <head> --><p a='1' b>x</p>",
        ] {
            assert_eq!(Document::from(page).html(), page);
        }
    }

    #[test]
    fn csp_nonces_and_hashes_like_tauri_codegen() {
        let page = r#"<html><head><script src="http://example.com/a.js"></script><script src="launch.js"></script><style>p{}</style><script>inline()</script><script></script></head><body></body></html>"#;
        let document = Document::from(page);
        for elem in document.select("script[src^='http']").nodes() {
            if elem.attr("nonce").is_none() {
                elem.set_attr("nonce", "N1");
            }
        }
        for elem in document.select("style").nodes() {
            elem.set_attr("nonce", "N2");
        }
        let inline: Vec<String> = document.select("script:not(:empty)").iter().map(|e| e.text()).collect();
        assert_eq!(inline, ["inline()"]);
        assert_eq!(document.select("script[src]").length(), 2);
        assert_eq!(
            document.html(),
            r#"<html><head><script src="http://example.com/a.js" nonce="N1"></script><script src="launch.js"></script><style nonce="N2">p{}</style><script>inline()</script><script></script></head><body></body></html>"#
        );
    }

    #[test]
    fn csp_meta_like_tauri_utils() {
        // tauri_utils::html2::inject_csp
        for page in ["<html><head></head></html>", "<html></html>"] {
            let document = Document::from(page);
            let head = document.head().unwrap_or_else(|| {
                let head = document.tree.new_element("head");
                document.html_root().prepend_child(&head);
                head
            });
            let meta = document.tree.new_element("meta");
            meta.set_attr("http-equiv", "Content-Security-Policy");
            meta.set_attr("content", "default-src 'self'");
            head.append_child(&meta);
            assert_eq!(
                document.html(),
                r#"<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"></head></html>"#
            );
        }
    }

    #[test]
    fn isolation_like_tauri_utils() {
        // tauri_utils::html2::inline_isolation
        let document = Document::from(r#"<html><head><script src="/index.js"></script></head></html>"#);
        for script in document.select("script[src]").nodes() {
            assert_eq!(script.attr("src").as_deref(), Some("/index.js"));
            script.set_text(String::from("run()"));
            script.remove_attr("src");
        }
        assert_eq!(document.html(), "<html><head><script>run()</script></head></html>");
    }
}
