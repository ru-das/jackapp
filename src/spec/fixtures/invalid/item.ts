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
        "type": "Text",
        "props": {
          "value": "{{$item.name}}"
        }
      }
    },
    "actions": {}
  },
  "expected": {
    "code": "BAD_VALUE",
    "path": "elements.root.props.value"
  }
};
