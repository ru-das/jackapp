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
        "props": {},
        "children": [
          "root"
        ]
      }
    },
    "actions": {}
  },
  "expected": {
    "code": "TREE",
    "path": "elements.root"
  }
};
