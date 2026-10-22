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
        "type": "TextInput",
        "props": {
          "bind": "missing",
          "label": "Name"
        }
      }
    },
    "actions": {}
  },
  "expected": {
    "code": "UNDECLARED_STATE",
    "path": "elements.root.props.bind"
  }
};
