export default {
  "input": {
    "specVersion": "0.1",
    "meta": {
      "name": "Test",
      "description": "",
      "icon": "🧊"
    },
    "state": {
      "n": {
        "type": "number",
        "default": 1
      }
    },
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
          "bind": "n",
          "label": "Name"
        }
      }
    },
    "actions": {}
  },
  "expected": {
    "code": "TYPE_MISMATCH",
    "path": "elements.root.props.bind"
  }
};
