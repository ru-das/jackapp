export default {
  "input": {
    "specVersion": "9",
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
        "children": []
      }
    },
    "actions": {}
  },
  "expected": {
    "code": "BAD_VERSION",
    "path": "specVersion"
  }
};
