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
        "type": "Stack",
        "props": {
          "gap": "huge"
        },
        "children": []
      }
    },
    "actions": {}
  },
  "expected": {
    "code": "BAD_PROP",
    "path": "elements.root.props.gap"
  }
};
