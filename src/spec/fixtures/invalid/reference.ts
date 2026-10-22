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
        "root": "missing"
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
    "code": "MISSING_REF",
    "path": "screens[0].root"
  }
};
