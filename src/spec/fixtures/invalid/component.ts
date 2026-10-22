export default {
  "input": {
    "specVersion": "0.1",
    "meta": {
      "name": "Test",
      "description": "",
      "icon": "🧊"
    },
    "state": {},
    "screens": [
      {
        "id": "main",
        "title": "Test",
        "root": "root"
      }
    ],
    "elements": {
      "root": {
        "type": "WebView",
        "props": {},
        "children": []
      }
    },
    "actions": {}
  },
  "expected": {
    "code": "UNKNOWN_COMPONENT",
    "path": "elements.root.type"
  }
};
