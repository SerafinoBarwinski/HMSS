/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(self["webpackChunk"] = self["webpackChunk"] || []).push([["home-js"],{

/***/ "./apps/legacy/controllers/home.js":
/*!*****************************************!*\
  !*** ./apps/legacy/controllers/home.js ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.symbol.js */ \"../node_modules/core-js/modules/es.symbol.js\");\n/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.symbol.description.js */ \"../node_modules/core-js/modules/es.symbol.description.js\");\n/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.symbol.iterator.js */ \"../node_modules/core-js/modules/es.symbol.iterator.js\");\n/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var core_js_modules_es_symbol_to_primitive_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.symbol.to-primitive.js */ \"../node_modules/core-js/modules/es.symbol.to-primitive.js\");\n/* harmony import */ var core_js_modules_es_symbol_to_primitive_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_to_primitive_js__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.iterator.js */ \"../node_modules/core-js/modules/es.array.iterator.js\");\n/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4__);\n/* harmony import */ var core_js_modules_es_date_to_primitive_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.date.to-primitive.js */ \"../node_modules/core-js/modules/es.date.to-primitive.js\");\n/* harmony import */ var core_js_modules_es_date_to_primitive_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_date_to_primitive_js__WEBPACK_IMPORTED_MODULE_5__);\n/* harmony import */ var core_js_modules_es_number_constructor_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.number.constructor.js */ \"../node_modules/core-js/modules/es.number.constructor.js\");\n/* harmony import */ var core_js_modules_es_number_constructor_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_number_constructor_js__WEBPACK_IMPORTED_MODULE_6__);\n/* harmony import */ var core_js_modules_es_object_define_property_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/es.object.define-property.js */ \"../node_modules/core-js/modules/es.object.define-property.js\");\n/* harmony import */ var core_js_modules_es_object_define_property_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_define_property_js__WEBPACK_IMPORTED_MODULE_7__);\n/* harmony import */ var core_js_modules_es_object_get_own_property_descriptor_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! core-js/modules/es.object.get-own-property-descriptor.js */ \"../node_modules/core-js/modules/es.object.get-own-property-descriptor.js\");\n/* harmony import */ var core_js_modules_es_object_get_own_property_descriptor_js__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_get_own_property_descriptor_js__WEBPACK_IMPORTED_MODULE_8__);\n/* harmony import */ var core_js_modules_es_object_get_prototype_of_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! core-js/modules/es.object.get-prototype-of.js */ \"../node_modules/core-js/modules/es.object.get-prototype-of.js\");\n/* harmony import */ var core_js_modules_es_object_get_prototype_of_js__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_get_prototype_of_js__WEBPACK_IMPORTED_MODULE_9__);\n/* harmony import */ var core_js_modules_es_object_set_prototype_of_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! core-js/modules/es.object.set-prototype-of.js */ \"../node_modules/core-js/modules/es.object.set-prototype-of.js\");\n/* harmony import */ var core_js_modules_es_object_set_prototype_of_js__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_set_prototype_of_js__WEBPACK_IMPORTED_MODULE_10__);\n/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ \"../node_modules/core-js/modules/es.object.to-string.js\");\n/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_11__);\n/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! core-js/modules/es.promise.js */ \"../node_modules/core-js/modules/es.promise.js\");\n/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_12__);\n/* harmony import */ var core_js_modules_es_reflect_construct_js__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! core-js/modules/es.reflect.construct.js */ \"../node_modules/core-js/modules/es.reflect.construct.js\");\n/* harmony import */ var core_js_modules_es_reflect_construct_js__WEBPACK_IMPORTED_MODULE_13___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_reflect_construct_js__WEBPACK_IMPORTED_MODULE_13__);\n/* harmony import */ var core_js_modules_es_reflect_get_js__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! core-js/modules/es.reflect.get.js */ \"../node_modules/core-js/modules/es.reflect.get.js\");\n/* harmony import */ var core_js_modules_es_reflect_get_js__WEBPACK_IMPORTED_MODULE_14___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_reflect_get_js__WEBPACK_IMPORTED_MODULE_14__);\n/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! core-js/modules/es.string.iterator.js */ \"../node_modules/core-js/modules/es.string.iterator.js\");\n/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_15___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_15__);\n/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ \"../node_modules/core-js/modules/web.dom-collections.iterator.js\");\n/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_16___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_16__);\n/* harmony import */ var components_tabbedview_tabbedview__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! components/tabbedview/tabbedview */ \"./components/tabbedview/tabbedview.js\");\n/* harmony import */ var lib_globalize__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! lib/globalize */ \"./lib/globalize/index.js\");\n/* harmony import */ var elements_emby_tabs_emby_tabs__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! elements/emby-tabs/emby-tabs */ \"./elements/emby-tabs/emby-tabs.js\");\n/* harmony import */ var elements_emby_button_emby_button__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! elements/emby-button/emby-button */ \"./elements/emby-button/emby-button.js\");\n/* harmony import */ var elements_emby_scroller_emby_scroller__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! elements/emby-scroller/emby-scroller */ \"./elements/emby-scroller/emby-scroller.js\");\n/* harmony import */ var scripts_libraryMenu__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! scripts/libraryMenu */ \"./scripts/libraryMenu.js\");\nfunction _typeof(o) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && \"function\" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? \"symbol\" : typeof o; }, _typeof(o); }\n;\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nfunction _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError(\"Cannot call a class as a function\"); }\nfunction _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, \"value\" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }\nfunction _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, \"prototype\", { writable: !1 }), e; }\nfunction _toPropertyKey(t) { var i = _toPrimitive(t, \"string\"); return \"symbol\" == _typeof(i) ? i : i + \"\"; }\nfunction _toPrimitive(t, r) { if (\"object\" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || \"default\"); if (\"object\" != _typeof(i)) return i; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (\"string\" === r ? String : Number)(t); }\nfunction _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }\nfunction _possibleConstructorReturn(t, e) { if (e && (\"object\" == _typeof(e) || \"function\" == typeof e)) return e; if (void 0 !== e) throw new TypeError(\"Derived constructors may only return object or undefined\"); return _assertThisInitialized(t); }\nfunction _assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError(\"this hasn't been initialised - super() hasn't been called\"); return e; }\nfunction _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }\nfunction _superPropGet(t, o, e, r) { var p = _get(_getPrototypeOf(1 & r ? t.prototype : t), o, e); return 2 & r && \"function\" == typeof p ? function (t) { return p.apply(e, t); } : p; }\nfunction _get() { return _get = \"undefined\" != typeof Reflect && Reflect.get ? Reflect.get.bind() : function (e, t, r) { var p = _superPropBase(e, t); if (p) { var n = Object.getOwnPropertyDescriptor(p, t); return n.get ? n.get.call(arguments.length < 3 ? e : r) : n.value; } }, _get.apply(null, arguments); }\nfunction _superPropBase(t, o) { for (; !{}.hasOwnProperty.call(t, o) && null !== (t = _getPrototypeOf(t));); return t; }\nfunction _getPrototypeOf(t) { return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, _getPrototypeOf(t); }\nfunction _inherits(t, e) { if (\"function\" != typeof e && null !== e) throw new TypeError(\"Super expression must either be null or a function\"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, \"prototype\", { writable: !1 }), e && _setPrototypeOf(t, e); }\nfunction _setPrototypeOf(t, e) { return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, _setPrototypeOf(t, e); }\n;\n\n\n\n\n\nvar HomeView = /*#__PURE__*/function (_TabbedView) {\n  function HomeView() {\n    _classCallCheck(this, HomeView);\n    return _callSuper(this, HomeView, arguments);\n  }\n  _inherits(HomeView, _TabbedView);\n  return _createClass(HomeView, [{\n    key: \"setTitle\",\n    value: function setTitle() {\n      scripts_libraryMenu__WEBPACK_IMPORTED_MODULE_22__[\"default\"].setTitle(null);\n    }\n  }, {\n    key: \"onPause\",\n    value: function onPause() {\n      _superPropGet(HomeView, \"onPause\", this, 3)([this]);\n      document.querySelector('.skinHeader').classList.remove('noHomeButtonHeader');\n    }\n  }, {\n    key: \"onResume\",\n    value: function onResume(options) {\n      _superPropGet(HomeView, \"onResume\", this, 3)([this, options]);\n      document.querySelector('.skinHeader').classList.add('noHomeButtonHeader');\n    }\n  }, {\n    key: \"getDefaultTabIndex\",\n    value: function getDefaultTabIndex() {\n      return 0;\n    }\n  }, {\n    key: \"getTabs\",\n    value: function getTabs() {\n      return [{\n        name: lib_globalize__WEBPACK_IMPORTED_MODULE_18__[\"default\"].translate('Home')\n      }, {\n        name: lib_globalize__WEBPACK_IMPORTED_MODULE_18__[\"default\"].translate('Favorites')\n      }];\n    }\n  }, {\n    key: \"getTabController\",\n    value: function getTabController(index) {\n      if (index == null) {\n        throw new Error('index cannot be null');\n      }\n      var depends = '';\n      switch (index) {\n        case 0:\n          depends = 'hometab';\n          break;\n        case 1:\n          depends = 'favorites';\n      }\n      var instance = this;\n      return __webpack_require__(\"./apps/legacy/controllers lazy recursive ^\\\\.\\\\/.*$ referencedExports: default\")(\"./\".concat(depends)).then(function (_ref) {\n        var ControllerFactory = _ref.default;\n        var controller = instance.tabControllers[index];\n        if (!controller) {\n          controller = new ControllerFactory(instance.view.querySelector(\".tabContent[data-index='\" + index + \"']\"), instance.params);\n          instance.tabControllers[index] = controller;\n        }\n        return controller;\n      });\n    }\n  }]);\n}(components_tabbedview_tabbedview__WEBPACK_IMPORTED_MODULE_17__[\"default\"]);\n/* harmony default export */ __webpack_exports__[\"default\"] = (HomeView);//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9hcHBzL2xlZ2FjeS9jb250cm9sbGVycy9ob21lLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQUE7QUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBRUE7QUFDQTtBQUFBO0FBQUE7QUFBQTtBQUdBO0FBQ0E7QUFDQTtBQUFBO0FBQUE7QUFBQTtBQUdBO0FBQ0E7QUFDQTtBQUFBO0FBQUE7QUFBQTtBQUdBO0FBQ0E7QUFBQTtBQUFBO0FBQUE7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFBQTtBQUFBO0FBQUE7QUFHQTtBQUNBO0FBQ0E7QUFFQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUFBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUFBO0FBQUE7QUFHQSIsInNvdXJjZXMiOlsid2VicGFjazovLy8uL2FwcHMvbGVnYWN5L2NvbnRyb2xsZXJzL2hvbWUuanM/NTUyNyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgVGFiYmVkVmlldyBmcm9tICdjb21wb25lbnRzL3RhYmJlZHZpZXcvdGFiYmVkdmlldyc7XG5pbXBvcnQgZ2xvYmFsaXplIGZyb20gJ2xpYi9nbG9iYWxpemUnO1xuaW1wb3J0ICdlbGVtZW50cy9lbWJ5LXRhYnMvZW1ieS10YWJzJztcbmltcG9ydCAnZWxlbWVudHMvZW1ieS1idXR0b24vZW1ieS1idXR0b24nO1xuaW1wb3J0ICdlbGVtZW50cy9lbWJ5LXNjcm9sbGVyL2VtYnktc2Nyb2xsZXInO1xuaW1wb3J0IExpYnJhcnlNZW51IGZyb20gJ3NjcmlwdHMvbGlicmFyeU1lbnUnO1xuXG5jbGFzcyBIb21lVmlldyBleHRlbmRzIFRhYmJlZFZpZXcge1xuICAgIHNldFRpdGxlKCkge1xuICAgICAgICBMaWJyYXJ5TWVudS5zZXRUaXRsZShudWxsKTtcbiAgICB9XG5cbiAgICBvblBhdXNlKCkge1xuICAgICAgICBzdXBlci5vblBhdXNlKHRoaXMpO1xuICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2tpbkhlYWRlcicpLmNsYXNzTGlzdC5yZW1vdmUoJ25vSG9tZUJ1dHRvbkhlYWRlcicpO1xuICAgIH1cblxuICAgIG9uUmVzdW1lKG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIub25SZXN1bWUodGhpcywgb3B0aW9ucyk7XG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5za2luSGVhZGVyJykuY2xhc3NMaXN0LmFkZCgnbm9Ib21lQnV0dG9uSGVhZGVyJyk7XG4gICAgfVxuXG4gICAgZ2V0RGVmYXVsdFRhYkluZGV4KCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBnZXRUYWJzKCkge1xuICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICAgIG5hbWU6IGdsb2JhbGl6ZS50cmFuc2xhdGUoJ0hvbWUnKVxuICAgICAgICB9LCB7XG4gICAgICAgICAgICBuYW1lOiBnbG9iYWxpemUudHJhbnNsYXRlKCdGYXZvcml0ZXMnKVxuICAgICAgICB9XTtcbiAgICB9XG5cbiAgICBnZXRUYWJDb250cm9sbGVyKGluZGV4KSB7XG4gICAgICAgIGlmIChpbmRleCA9PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luZGV4IGNhbm5vdCBiZSBudWxsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZGVwZW5kcyA9ICcnO1xuXG4gICAgICAgIHN3aXRjaCAoaW5kZXgpIHtcbiAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICBkZXBlbmRzID0gJ2hvbWV0YWInO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgZGVwZW5kcyA9ICdmYXZvcml0ZXMnO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzO1xuICAgICAgICByZXR1cm4gaW1wb3J0KC8qIHdlYnBhY2tDaHVua05hbWU6IFwiW3JlcXVlc3RdXCIgKi8gYC4uL2NvbnRyb2xsZXJzLyR7ZGVwZW5kc31gKS50aGVuKCh7IGRlZmF1bHQ6IENvbnRyb2xsZXJGYWN0b3J5IH0pID0+IHtcbiAgICAgICAgICAgIGxldCBjb250cm9sbGVyID0gaW5zdGFuY2UudGFiQ29udHJvbGxlcnNbaW5kZXhdO1xuXG4gICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyID0gbmV3IENvbnRyb2xsZXJGYWN0b3J5KGluc3RhbmNlLnZpZXcucXVlcnlTZWxlY3RvcihcIi50YWJDb250ZW50W2RhdGEtaW5kZXg9J1wiICsgaW5kZXggKyBcIiddXCIpLCBpbnN0YW5jZS5wYXJhbXMpO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLnRhYkNvbnRyb2xsZXJzW2luZGV4XSA9IGNvbnRyb2xsZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250cm9sbGVyO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEhvbWVWaWV3O1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./apps/legacy/controllers/home.js\n\n}");

/***/ }),

/***/ "./components/maintabsmanager.js":
/*!***************************************!*\
  !*** ./components/maintabsmanager.js ***!
  \***************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getTabsElement: function() { return /* binding */ getTabsElement; },\n/* harmony export */   selectedTabIndex: function() { return /* binding */ selectedTabIndex; },\n/* harmony export */   setTabs: function() { return /* binding */ setTabs; }\n/* harmony export */ });\n/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.iterator.js */ \"../node_modules/core-js/modules/es.array.iterator.js\");\n/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.map.js */ \"../node_modules/core-js/modules/es.array.map.js\");\n/* harmony import */ var core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ \"../node_modules/core-js/modules/es.object.to-string.js\");\n/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.promise.js */ \"../node_modules/core-js/modules/es.promise.js\");\n/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.iterator.js */ \"../node_modules/core-js/modules/es.string.iterator.js\");\n/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_4__);\n/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ \"../node_modules/core-js/modules/web.dom-collections.iterator.js\");\n/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_5__);\n/* harmony import */ var _utils_dom__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../utils/dom */ \"./utils/dom.js\");\n/* harmony import */ var _scripts_browser__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../scripts/browser */ \"./scripts/browser.js\");\n/* harmony import */ var _layoutManager__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./layoutManager */ \"./components/layoutManager.js\");\n/* harmony import */ var _utils_events_ts__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils/events.ts */ \"./utils/events.ts\");\n/* harmony import */ var _elements_emby_tabs_emby_tabs__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../elements/emby-tabs/emby-tabs */ \"./elements/emby-tabs/emby-tabs.js\");\n/* harmony import */ var _elements_emby_button_emby_button__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../elements/emby-button/emby-button */ \"./elements/emby-button/emby-button.js\");\n\n\n\n\n\n\n\n\n\n\n\n\nvar tabOwnerView;\nvar queryScope = document.querySelector('.skinHeader');\nvar headerTabsContainer;\nvar tabsElem;\nfunction ensureElements() {\n  if (!headerTabsContainer) {\n    headerTabsContainer = queryScope.querySelector('.headerTabs');\n  }\n}\nfunction onViewTabsReady() {\n  this.selectedIndex(this.readySelectedIndex);\n  this.readySelectedIndex = null;\n}\nfunction allowSwipe(target) {\n  function allowSwipeOn(elem) {\n    if (_utils_dom__WEBPACK_IMPORTED_MODULE_6__[\"default\"].parentWithTag(elem, 'input')) {\n      return false;\n    }\n    var classList = elem.classList;\n    if (classList) {\n      return !classList.contains('scrollX') && !classList.contains('animatedScrollX');\n    }\n    return true;\n  }\n  var parent = target;\n  while (parent != null) {\n    if (!allowSwipeOn(parent)) {\n      return false;\n    }\n    parent = parent.parentNode;\n  }\n  return true;\n}\nfunction configureSwipeTabs(view, currentElement) {\n  if (!_scripts_browser__WEBPACK_IMPORTED_MODULE_7__[\"default\"].touch || _layoutManager__WEBPACK_IMPORTED_MODULE_8__[\"default\"].modern) {\n    return;\n  }\n\n  // implement without hammer\n  var onSwipeLeft = function onSwipeLeft(e, target) {\n    if (allowSwipe(target) && view.contains(target)) {\n      currentElement.selectNext();\n    }\n  };\n  var onSwipeRight = function onSwipeRight(e, target) {\n    if (allowSwipe(target) && view.contains(target)) {\n      currentElement.selectPrevious();\n    }\n  };\n  __webpack_require__.e(/*! import() */ \"scripts_touchHelper_js\").then(__webpack_require__.bind(__webpack_require__, /*! ../scripts/touchHelper */ \"./scripts/touchHelper.js\")).then(function (_ref) {\n    var TouchHelper = _ref.default;\n    var touchHelper = new TouchHelper(view.parentNode.parentNode);\n    _utils_events_ts__WEBPACK_IMPORTED_MODULE_9__[\"default\"].on(touchHelper, 'swipeleft', onSwipeLeft);\n    _utils_events_ts__WEBPACK_IMPORTED_MODULE_9__[\"default\"].on(touchHelper, 'swiperight', onSwipeRight);\n    view.addEventListener('viewdestroy', function () {\n      touchHelper.destroy();\n    });\n  });\n}\nfunction setTabs(view, selectedIndex, getTabsFn, getTabContainersFn, onBeforeTabChange, onTabChange, setSelectedIndex) {\n  ensureElements();\n  if (!view) {\n    if (tabOwnerView) {\n      document.body.classList.remove('withSectionTabs');\n      headerTabsContainer.innerHTML = '';\n      headerTabsContainer.classList.add('hide');\n      tabOwnerView = null;\n    }\n    return {\n      tabsContainer: headerTabsContainer,\n      replaced: false\n    };\n  }\n  var tabsContainerElem = headerTabsContainer;\n  if (!tabOwnerView) {\n    tabsContainerElem.classList.remove('hide');\n  }\n  if (tabOwnerView !== view) {\n    var index = 0;\n    var indexAttribute = selectedIndex == null ? '' : ' data-index=\"' + selectedIndex + '\"';\n    var tabsHtml = '<div is=\"emby-tabs\"' + indexAttribute + ' class=\"tabs-viewmenubar\"><div class=\"emby-tabs-slider\" style=\"white-space:nowrap;\">' + getTabsFn().map(function (t) {\n      var tabClass = 'emby-tab-button';\n      if (t.enabled === false) {\n        tabClass += ' hide';\n      }\n      var tabHtml;\n      if (t.cssClass) {\n        tabClass += ' ' + t.cssClass;\n      }\n      if (t.href) {\n        tabHtml = '<a href=\"' + t.href + '\" is=\"emby-linkbutton\" class=\"' + tabClass + '\" data-index=\"' + index + '\"><div class=\"emby-button-foreground\">' + t.name + '</div></a>';\n      } else {\n        tabHtml = '<button type=\"button\" is=\"emby-button\" class=\"' + tabClass + '\" data-index=\"' + index + '\"><div class=\"emby-button-foreground\">' + t.name + '</div></button>';\n      }\n      index++;\n      return tabHtml;\n    }).join('') + '</div></div>';\n    tabsContainerElem.innerHTML = tabsHtml;\n    window.CustomElements.upgradeSubtree(tabsContainerElem);\n    document.body.classList.add('withSectionTabs');\n    tabOwnerView = view;\n    tabsElem = tabsContainerElem.querySelector('[is=\"emby-tabs\"]');\n    configureSwipeTabs(view, tabsElem);\n    if (getTabContainersFn) {\n      tabsElem.addEventListener('beforetabchange', function (e) {\n        var tabContainers = getTabContainersFn();\n        if (e.detail.previousIndex != null) {\n          var previousPanel = tabContainers[e.detail.previousIndex];\n          if (previousPanel) {\n            previousPanel.classList.remove('is-active');\n          }\n        }\n        var newPanel = tabContainers[e.detail.selectedTabIndex];\n        if (newPanel) {\n          newPanel.classList.add('is-active');\n        }\n      });\n    }\n    if (onBeforeTabChange) {\n      tabsElem.addEventListener('beforetabchange', onBeforeTabChange);\n    }\n    if (onTabChange) {\n      tabsElem.addEventListener('tabchange', onTabChange);\n    }\n    if (setSelectedIndex !== false) {\n      if (tabsElem.selectedIndex) {\n        tabsElem.selectedIndex(selectedIndex);\n      } else {\n        tabsElem.readySelectedIndex = selectedIndex;\n        tabsElem.addEventListener('ready', onViewTabsReady);\n      }\n    }\n    return {\n      tabsContainer: tabsContainerElem,\n      tabs: tabsElem,\n      replaced: true\n    };\n  }\n  tabsElem.selectedIndex(selectedIndex);\n  return {\n    tabsContainer: tabsContainerElem,\n    tabs: tabsElem,\n    replaced: false\n  };\n}\nfunction selectedTabIndex(index) {\n  if (index != null) {\n    tabsElem.selectedIndex(index);\n  } else {\n    tabsElem.triggerTabChange();\n  }\n}\nfunction getTabsElement() {\n  return document.querySelector('.tabs-viewmenubar');\n}//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jb21wb25lbnRzL21haW50YWJzbWFuYWdlci5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFBQTtBQUNBO0FBRUE7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFFQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFFQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUVBO0FBQ0E7QUFFQTtBQUVBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9jb21wb25lbnRzL21haW50YWJzbWFuYWdlci5qcz9iMTdhIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkb20gZnJvbSAnLi4vdXRpbHMvZG9tJztcbmltcG9ydCBicm93c2VyIGZyb20gJy4uL3NjcmlwdHMvYnJvd3Nlcic7XG5pbXBvcnQgbGF5b3V0TWFuYWdlciBmcm9tICcuL2xheW91dE1hbmFnZXInO1xuaW1wb3J0IEV2ZW50cyBmcm9tICcuLi91dGlscy9ldmVudHMudHMnO1xuaW1wb3J0ICcuLi9lbGVtZW50cy9lbWJ5LXRhYnMvZW1ieS10YWJzJztcbmltcG9ydCAnLi4vZWxlbWVudHMvZW1ieS1idXR0b24vZW1ieS1idXR0b24nO1xuXG5sZXQgdGFiT3duZXJWaWV3O1xuY29uc3QgcXVlcnlTY29wZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5za2luSGVhZGVyJyk7XG5sZXQgaGVhZGVyVGFic0NvbnRhaW5lcjtcbmxldCB0YWJzRWxlbTtcblxuZnVuY3Rpb24gZW5zdXJlRWxlbWVudHMoKSB7XG4gICAgaWYgKCFoZWFkZXJUYWJzQ29udGFpbmVyKSB7XG4gICAgICAgIGhlYWRlclRhYnNDb250YWluZXIgPSBxdWVyeVNjb3BlLnF1ZXJ5U2VsZWN0b3IoJy5oZWFkZXJUYWJzJyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBvblZpZXdUYWJzUmVhZHkoKSB7XG4gICAgdGhpcy5zZWxlY3RlZEluZGV4KHRoaXMucmVhZHlTZWxlY3RlZEluZGV4KTtcbiAgICB0aGlzLnJlYWR5U2VsZWN0ZWRJbmRleCA9IG51bGw7XG59XG5cbmZ1bmN0aW9uIGFsbG93U3dpcGUodGFyZ2V0KSB7XG4gICAgZnVuY3Rpb24gYWxsb3dTd2lwZU9uKGVsZW0pIHtcbiAgICAgICAgaWYgKGRvbS5wYXJlbnRXaXRoVGFnKGVsZW0sICdpbnB1dCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjbGFzc0xpc3QgPSBlbGVtLmNsYXNzTGlzdDtcbiAgICAgICAgaWYgKGNsYXNzTGlzdCkge1xuICAgICAgICAgICAgcmV0dXJuICFjbGFzc0xpc3QuY29udGFpbnMoJ3Njcm9sbFgnKSAmJiAhY2xhc3NMaXN0LmNvbnRhaW5zKCdhbmltYXRlZFNjcm9sbFgnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGxldCBwYXJlbnQgPSB0YXJnZXQ7XG4gICAgd2hpbGUgKHBhcmVudCAhPSBudWxsKSB7XG4gICAgICAgIGlmICghYWxsb3dTd2lwZU9uKHBhcmVudCkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gY29uZmlndXJlU3dpcGVUYWJzKHZpZXcsIGN1cnJlbnRFbGVtZW50KSB7XG4gICAgaWYgKCFicm93c2VyLnRvdWNoIHx8IGxheW91dE1hbmFnZXIubW9kZXJuKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBpbXBsZW1lbnQgd2l0aG91dCBoYW1tZXJcbiAgICBjb25zdCBvblN3aXBlTGVmdCA9IGZ1bmN0aW9uIChlLCB0YXJnZXQpIHtcbiAgICAgICAgaWYgKGFsbG93U3dpcGUodGFyZ2V0KSAmJiB2aWV3LmNvbnRhaW5zKHRhcmdldCkpIHtcbiAgICAgICAgICAgIGN1cnJlbnRFbGVtZW50LnNlbGVjdE5leHQoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBvblN3aXBlUmlnaHQgPSBmdW5jdGlvbiAoZSwgdGFyZ2V0KSB7XG4gICAgICAgIGlmIChhbGxvd1N3aXBlKHRhcmdldCkgJiYgdmlldy5jb250YWlucyh0YXJnZXQpKSB7XG4gICAgICAgICAgICBjdXJyZW50RWxlbWVudC5zZWxlY3RQcmV2aW91cygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGltcG9ydCgnLi4vc2NyaXB0cy90b3VjaEhlbHBlcicpLnRoZW4oKHsgZGVmYXVsdDogVG91Y2hIZWxwZXIgfSkgPT4ge1xuICAgICAgICBjb25zdCB0b3VjaEhlbHBlciA9IG5ldyBUb3VjaEhlbHBlcih2aWV3LnBhcmVudE5vZGUucGFyZW50Tm9kZSk7XG5cbiAgICAgICAgRXZlbnRzLm9uKHRvdWNoSGVscGVyLCAnc3dpcGVsZWZ0Jywgb25Td2lwZUxlZnQpO1xuICAgICAgICBFdmVudHMub24odG91Y2hIZWxwZXIsICdzd2lwZXJpZ2h0Jywgb25Td2lwZVJpZ2h0KTtcblxuICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3ZpZXdkZXN0cm95JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdG91Y2hIZWxwZXIuZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFRhYnModmlldywgc2VsZWN0ZWRJbmRleCwgZ2V0VGFic0ZuLCBnZXRUYWJDb250YWluZXJzRm4sIG9uQmVmb3JlVGFiQ2hhbmdlLCBvblRhYkNoYW5nZSwgc2V0U2VsZWN0ZWRJbmRleCkge1xuICAgIGVuc3VyZUVsZW1lbnRzKCk7XG5cbiAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgaWYgKHRhYk93bmVyVmlldykge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCd3aXRoU2VjdGlvblRhYnMnKTtcblxuICAgICAgICAgICAgaGVhZGVyVGFic0NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgICAgIGhlYWRlclRhYnNDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuXG4gICAgICAgICAgICB0YWJPd25lclZpZXcgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0YWJzQ29udGFpbmVyOiBoZWFkZXJUYWJzQ29udGFpbmVyLFxuICAgICAgICAgICAgcmVwbGFjZWQ6IGZhbHNlXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgdGFic0NvbnRhaW5lckVsZW0gPSBoZWFkZXJUYWJzQ29udGFpbmVyO1xuXG4gICAgaWYgKCF0YWJPd25lclZpZXcpIHtcbiAgICAgICAgdGFic0NvbnRhaW5lckVsZW0uY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuICAgIH1cblxuICAgIGlmICh0YWJPd25lclZpZXcgIT09IHZpZXcpIHtcbiAgICAgICAgbGV0IGluZGV4ID0gMDtcblxuICAgICAgICBjb25zdCBpbmRleEF0dHJpYnV0ZSA9IHNlbGVjdGVkSW5kZXggPT0gbnVsbCA/ICcnIDogKCcgZGF0YS1pbmRleD1cIicgKyBzZWxlY3RlZEluZGV4ICsgJ1wiJyk7XG4gICAgICAgIGNvbnN0IHRhYnNIdG1sID0gJzxkaXYgaXM9XCJlbWJ5LXRhYnNcIicgKyBpbmRleEF0dHJpYnV0ZSArICcgY2xhc3M9XCJ0YWJzLXZpZXdtZW51YmFyXCI+PGRpdiBjbGFzcz1cImVtYnktdGFicy1zbGlkZXJcIiBzdHlsZT1cIndoaXRlLXNwYWNlOm5vd3JhcDtcIj4nICsgZ2V0VGFic0ZuKCkubWFwKGZ1bmN0aW9uICh0KSB7XG4gICAgICAgICAgICBsZXQgdGFiQ2xhc3MgPSAnZW1ieS10YWItYnV0dG9uJztcblxuICAgICAgICAgICAgaWYgKHQuZW5hYmxlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICB0YWJDbGFzcyArPSAnIGhpZGUnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgdGFiSHRtbDtcblxuICAgICAgICAgICAgaWYgKHQuY3NzQ2xhc3MpIHtcbiAgICAgICAgICAgICAgICB0YWJDbGFzcyArPSAnICcgKyB0LmNzc0NsYXNzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodC5ocmVmKSB7XG4gICAgICAgICAgICAgICAgdGFiSHRtbCA9ICc8YSBocmVmPVwiJyArIHQuaHJlZiArICdcIiBpcz1cImVtYnktbGlua2J1dHRvblwiIGNsYXNzPVwiJyArIHRhYkNsYXNzICsgJ1wiIGRhdGEtaW5kZXg9XCInICsgaW5kZXggKyAnXCI+PGRpdiBjbGFzcz1cImVtYnktYnV0dG9uLWZvcmVncm91bmRcIj4nICsgdC5uYW1lICsgJzwvZGl2PjwvYT4nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YWJIdG1sID0gJzxidXR0b24gdHlwZT1cImJ1dHRvblwiIGlzPVwiZW1ieS1idXR0b25cIiBjbGFzcz1cIicgKyB0YWJDbGFzcyArICdcIiBkYXRhLWluZGV4PVwiJyArIGluZGV4ICsgJ1wiPjxkaXYgY2xhc3M9XCJlbWJ5LWJ1dHRvbi1mb3JlZ3JvdW5kXCI+JyArIHQubmFtZSArICc8L2Rpdj48L2J1dHRvbj4nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgcmV0dXJuIHRhYkh0bWw7XG4gICAgICAgIH0pLmpvaW4oJycpICsgJzwvZGl2PjwvZGl2Pic7XG5cbiAgICAgICAgdGFic0NvbnRhaW5lckVsZW0uaW5uZXJIVE1MID0gdGFic0h0bWw7XG4gICAgICAgIHdpbmRvdy5DdXN0b21FbGVtZW50cy51cGdyYWRlU3VidHJlZSh0YWJzQ29udGFpbmVyRWxlbSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCd3aXRoU2VjdGlvblRhYnMnKTtcbiAgICAgICAgdGFiT3duZXJWaWV3ID0gdmlldztcblxuICAgICAgICB0YWJzRWxlbSA9IHRhYnNDb250YWluZXJFbGVtLnF1ZXJ5U2VsZWN0b3IoJ1tpcz1cImVtYnktdGFic1wiXScpO1xuXG4gICAgICAgIGNvbmZpZ3VyZVN3aXBlVGFicyh2aWV3LCB0YWJzRWxlbSk7XG5cbiAgICAgICAgaWYgKGdldFRhYkNvbnRhaW5lcnNGbikge1xuICAgICAgICAgICAgdGFic0VsZW0uYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldGFiY2hhbmdlJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YWJDb250YWluZXJzID0gZ2V0VGFiQ29udGFpbmVyc0ZuKCk7XG4gICAgICAgICAgICAgICAgaWYgKGUuZGV0YWlsLnByZXZpb3VzSW5kZXggIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmV2aW91c1BhbmVsID0gdGFiQ29udGFpbmVyc1tlLmRldGFpbC5wcmV2aW91c0luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZXZpb3VzUGFuZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzUGFuZWwuY2xhc3NMaXN0LnJlbW92ZSgnaXMtYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBuZXdQYW5lbCA9IHRhYkNvbnRhaW5lcnNbZS5kZXRhaWwuc2VsZWN0ZWRUYWJJbmRleF07XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3UGFuZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3UGFuZWwuY2xhc3NMaXN0LmFkZCgnaXMtYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob25CZWZvcmVUYWJDaGFuZ2UpIHtcbiAgICAgICAgICAgIHRhYnNFbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXRhYmNoYW5nZScsIG9uQmVmb3JlVGFiQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob25UYWJDaGFuZ2UpIHtcbiAgICAgICAgICAgIHRhYnNFbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ3RhYmNoYW5nZScsIG9uVGFiQ2hhbmdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZXRTZWxlY3RlZEluZGV4ICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgaWYgKHRhYnNFbGVtLnNlbGVjdGVkSW5kZXgpIHtcbiAgICAgICAgICAgICAgICB0YWJzRWxlbS5zZWxlY3RlZEluZGV4KHNlbGVjdGVkSW5kZXgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YWJzRWxlbS5yZWFkeVNlbGVjdGVkSW5kZXggPSBzZWxlY3RlZEluZGV4O1xuICAgICAgICAgICAgICAgIHRhYnNFbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ3JlYWR5Jywgb25WaWV3VGFic1JlYWR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0YWJzQ29udGFpbmVyOiB0YWJzQ29udGFpbmVyRWxlbSxcbiAgICAgICAgICAgIHRhYnM6IHRhYnNFbGVtLFxuICAgICAgICAgICAgcmVwbGFjZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB0YWJzRWxlbS5zZWxlY3RlZEluZGV4KHNlbGVjdGVkSW5kZXgpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGFic0NvbnRhaW5lcjogdGFic0NvbnRhaW5lckVsZW0sXG4gICAgICAgIHRhYnM6IHRhYnNFbGVtLFxuICAgICAgICByZXBsYWNlZDogZmFsc2VcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VsZWN0ZWRUYWJJbmRleChpbmRleCkge1xuICAgIGlmIChpbmRleCAhPSBudWxsKSB7XG4gICAgICAgIHRhYnNFbGVtLnNlbGVjdGVkSW5kZXgoaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRhYnNFbGVtLnRyaWdnZXJUYWJDaGFuZ2UoKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUYWJzRWxlbWVudCgpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnRhYnMtdmlld21lbnViYXInKTtcbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./components/maintabsmanager.js\n\n}");

/***/ }),

/***/ "./components/tabbedview/tabbedview.js":
/*!*********************************************!*\
  !*** ./components/tabbedview/tabbedview.js ***!
  \*********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.symbol.js */ \"../node_modules/core-js/modules/es.symbol.js\");\n/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.symbol.description.js */ \"../node_modules/core-js/modules/es.symbol.description.js\");\n/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.symbol.iterator.js */ \"../node_modules/core-js/modules/es.symbol.iterator.js\");\n/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var core_js_modules_es_symbol_to_primitive_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.symbol.to-primitive.js */ \"../node_modules/core-js/modules/es.symbol.to-primitive.js\");\n/* harmony import */ var core_js_modules_es_symbol_to_primitive_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_to_primitive_js__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.iterator.js */ \"../node_modules/core-js/modules/es.array.iterator.js\");\n/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4__);\n/* harmony import */ var core_js_modules_es_date_to_primitive_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.date.to-primitive.js */ \"../node_modules/core-js/modules/es.date.to-primitive.js\");\n/* harmony import */ var core_js_modules_es_date_to_primitive_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_date_to_primitive_js__WEBPACK_IMPORTED_MODULE_5__);\n/* harmony import */ var core_js_modules_es_number_constructor_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.number.constructor.js */ \"../node_modules/core-js/modules/es.number.constructor.js\");\n/* harmony import */ var core_js_modules_es_number_constructor_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_number_constructor_js__WEBPACK_IMPORTED_MODULE_6__);\n/* harmony import */ var core_js_modules_es_object_define_property_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/es.object.define-property.js */ \"../node_modules/core-js/modules/es.object.define-property.js\");\n/* harmony import */ var core_js_modules_es_object_define_property_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_define_property_js__WEBPACK_IMPORTED_MODULE_7__);\n/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ \"../node_modules/core-js/modules/es.object.to-string.js\");\n/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_8__);\n/* harmony import */ var core_js_modules_es_parse_int_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! core-js/modules/es.parse-int.js */ \"../node_modules/core-js/modules/es.parse-int.js\");\n/* harmony import */ var core_js_modules_es_parse_int_js__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_parse_int_js__WEBPACK_IMPORTED_MODULE_9__);\n/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! core-js/modules/es.promise.js */ \"../node_modules/core-js/modules/es.promise.js\");\n/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_10__);\n/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! core-js/modules/es.string.iterator.js */ \"../node_modules/core-js/modules/es.string.iterator.js\");\n/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_11__);\n/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! core-js/modules/web.dom-collections.for-each.js */ \"../node_modules/core-js/modules/web.dom-collections.for-each.js\");\n/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_12__);\n/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ \"../node_modules/core-js/modules/web.dom-collections.iterator.js\");\n/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_13___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_13__);\n/* harmony import */ var _backdrop_backdrop__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../backdrop/backdrop */ \"./components/backdrop/backdrop.js\");\n/* harmony import */ var _maintabsmanager__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../maintabsmanager */ \"./components/maintabsmanager.js\");\n/* harmony import */ var _layoutManager__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../layoutManager */ \"./components/layoutManager.js\");\n/* harmony import */ var _elements_emby_tabs_emby_tabs__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../../elements/emby-tabs/emby-tabs */ \"./elements/emby-tabs/emby-tabs.js\");\n/* harmony import */ var _scripts_libraryMenu__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../../scripts/libraryMenu */ \"./scripts/libraryMenu.js\");\nfunction _typeof(o) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && \"function\" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? \"symbol\" : typeof o; }, _typeof(o); }\nfunction _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError(\"Cannot call a class as a function\"); }\nfunction _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, \"value\" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }\nfunction _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, \"prototype\", { writable: !1 }), e; }\nfunction _toPropertyKey(t) { var i = _toPrimitive(t, \"string\"); return \"symbol\" == _typeof(i) ? i : i + \"\"; }\nfunction _toPrimitive(t, r) { if (\"object\" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || \"default\"); if (\"object\" != _typeof(i)) return i; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (\"string\" === r ? String : Number)(t); }\n;\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nfunction onViewDestroy() {\n  var tabControllers = this.tabControllers;\n  if (tabControllers) {\n    tabControllers.forEach(function (t) {\n      if (t.destroy) {\n        t.destroy();\n      }\n    });\n    this.tabControllers = null;\n  }\n  this.view = null;\n  this.params = null;\n  this.currentTabController = null;\n  this.initialTabIndex = null;\n}\nvar TabbedView = /*#__PURE__*/function () {\n  function TabbedView(view, params) {\n    _classCallCheck(this, TabbedView);\n    this.tabControllers = [];\n    this.view = view;\n    this.params = params;\n    var self = this;\n    var currentTabIndex = parseInt(params.tab || this.getDefaultTabIndex(params.parentId), 10);\n    this.initialTabIndex = currentTabIndex;\n    function validateTabLoad(index) {\n      return self.validateTabLoad ? self.validateTabLoad(index) : Promise.resolve();\n    }\n    function loadTab(index, previousIndex) {\n      validateTabLoad(index).then(function () {\n        self.getTabController(index).then(function (controller) {\n          var refresh = !controller.refreshed;\n          controller.onResume({\n            autoFocus: previousIndex == null && _layoutManager__WEBPACK_IMPORTED_MODULE_16__[\"default\"].tv,\n            refresh: refresh\n          });\n          controller.refreshed = true;\n          currentTabIndex = index;\n          self.currentTabController = controller;\n        });\n      });\n    }\n    function getTabContainers() {\n      return view.querySelectorAll('.tabContent');\n    }\n    function onTabChange(e) {\n      var newIndex = parseInt(e.detail.selectedTabIndex, 10);\n      var previousIndex = e.detail.previousIndex;\n      var previousTabController = previousIndex == null ? null : self.tabControllers[previousIndex];\n      if (previousTabController !== null && previousTabController !== void 0 && previousTabController.onPause) {\n        previousTabController.onPause();\n      }\n      loadTab(newIndex, previousIndex);\n    }\n    view.addEventListener('viewbeforehide', this.onPause.bind(this));\n    view.addEventListener('viewbeforeshow', function () {\n      _maintabsmanager__WEBPACK_IMPORTED_MODULE_15__.setTabs(view, currentTabIndex, self.getTabs, getTabContainers, null, onTabChange, false);\n    });\n    view.addEventListener('viewshow', function (e) {\n      self.onResume(e.detail);\n    });\n    view.addEventListener('viewdestroy', onViewDestroy.bind(this));\n  }\n  return _createClass(TabbedView, [{\n    key: \"onResume\",\n    value: function onResume() {\n      this.setTitle();\n      (0,_backdrop_backdrop__WEBPACK_IMPORTED_MODULE_14__.clearBackdrop)();\n      var currentTabController = this.currentTabController;\n      if (!currentTabController) {\n        _maintabsmanager__WEBPACK_IMPORTED_MODULE_15__.selectedTabIndex(this.initialTabIndex);\n      } else if (currentTabController !== null && currentTabController !== void 0 && currentTabController.onResume) {\n        currentTabController.onResume({});\n      }\n    }\n  }, {\n    key: \"onPause\",\n    value: function onPause() {\n      var currentTabController = this.currentTabController;\n      if (currentTabController !== null && currentTabController !== void 0 && currentTabController.onPause) {\n        currentTabController.onPause();\n      }\n    }\n  }, {\n    key: \"setTitle\",\n    value: function setTitle() {\n      _scripts_libraryMenu__WEBPACK_IMPORTED_MODULE_18__[\"default\"].setTitle('');\n    }\n  }]);\n}();\n/* harmony default export */ __webpack_exports__[\"default\"] = (TabbedView);//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jb21wb25lbnRzL3RhYmJlZHZpZXcvdGFiYmVkdmlldy5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQUE7QUFHQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFFQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUVBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUFBO0FBQUE7QUFBQTtBQUdBO0FBQ0E7QUFFQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUFBO0FBQUE7QUFBQTtBQUdBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFBQTtBQUFBO0FBQUE7QUFHQTtBQUNBO0FBQUE7QUFBQTtBQUdBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vLy4vY29tcG9uZW50cy90YWJiZWR2aWV3L3RhYmJlZHZpZXcuanM/Y2M2OCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjbGVhckJhY2tkcm9wIH0gZnJvbSAnLi4vYmFja2Ryb3AvYmFja2Ryb3AnO1xuaW1wb3J0ICogYXMgbWFpblRhYnNNYW5hZ2VyIGZyb20gJy4uL21haW50YWJzbWFuYWdlcic7XG5pbXBvcnQgbGF5b3V0TWFuYWdlciBmcm9tICcuLi9sYXlvdXRNYW5hZ2VyJztcbmltcG9ydCAnLi4vLi4vZWxlbWVudHMvZW1ieS10YWJzL2VtYnktdGFicyc7XG5pbXBvcnQgTGlicmFyeU1lbnUgZnJvbSAnLi4vLi4vc2NyaXB0cy9saWJyYXJ5TWVudSc7XG5cbmZ1bmN0aW9uIG9uVmlld0Rlc3Ryb3koKSB7XG4gICAgY29uc3QgdGFiQ29udHJvbGxlcnMgPSB0aGlzLnRhYkNvbnRyb2xsZXJzO1xuXG4gICAgaWYgKHRhYkNvbnRyb2xsZXJzKSB7XG4gICAgICAgIHRhYkNvbnRyb2xsZXJzLmZvckVhY2goZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgICAgIGlmICh0LmRlc3Ryb3kpIHtcbiAgICAgICAgICAgICAgICB0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy50YWJDb250cm9sbGVycyA9IG51bGw7XG4gICAgfVxuXG4gICAgdGhpcy52aWV3ID0gbnVsbDtcbiAgICB0aGlzLnBhcmFtcyA9IG51bGw7XG4gICAgdGhpcy5jdXJyZW50VGFiQ29udHJvbGxlciA9IG51bGw7XG4gICAgdGhpcy5pbml0aWFsVGFiSW5kZXggPSBudWxsO1xufVxuXG5jbGFzcyBUYWJiZWRWaWV3IHtcbiAgICBjb25zdHJ1Y3Rvcih2aWV3LCBwYXJhbXMpIHtcbiAgICAgICAgdGhpcy50YWJDb250cm9sbGVycyA9IFtdO1xuICAgICAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHBhcmFtcztcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBsZXQgY3VycmVudFRhYkluZGV4ID0gcGFyc2VJbnQocGFyYW1zLnRhYiB8fCB0aGlzLmdldERlZmF1bHRUYWJJbmRleChwYXJhbXMucGFyZW50SWQpLCAxMCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbFRhYkluZGV4ID0gY3VycmVudFRhYkluZGV4O1xuXG4gICAgICAgIGZ1bmN0aW9uIHZhbGlkYXRlVGFiTG9hZChpbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYudmFsaWRhdGVUYWJMb2FkID8gc2VsZi52YWxpZGF0ZVRhYkxvYWQoaW5kZXgpIDogUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBsb2FkVGFiKGluZGV4LCBwcmV2aW91c0luZGV4KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZVRhYkxvYWQoaW5kZXgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNlbGYuZ2V0VGFiQ29udHJvbGxlcihpbmRleCkudGhlbihmdW5jdGlvbiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWZyZXNoID0gIWNvbnRyb2xsZXIucmVmcmVzaGVkO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIub25SZXN1bWUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXV0b0ZvY3VzOiBwcmV2aW91c0luZGV4ID09IG51bGwgJiYgbGF5b3V0TWFuYWdlci50dixcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZnJlc2g6IHJlZnJlc2hcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWZyZXNoZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUYWJJbmRleCA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmN1cnJlbnRUYWJDb250cm9sbGVyID0gY29udHJvbGxlcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0VGFiQ29udGFpbmVycygpIHtcbiAgICAgICAgICAgIHJldHVybiB2aWV3LnF1ZXJ5U2VsZWN0b3JBbGwoJy50YWJDb250ZW50Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvblRhYkNoYW5nZShlKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdJbmRleCA9IHBhcnNlSW50KGUuZGV0YWlsLnNlbGVjdGVkVGFiSW5kZXgsIDEwKTtcbiAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzSW5kZXggPSBlLmRldGFpbC5wcmV2aW91c0luZGV4O1xuXG4gICAgICAgICAgICBjb25zdCBwcmV2aW91c1RhYkNvbnRyb2xsZXIgPSBwcmV2aW91c0luZGV4ID09IG51bGwgPyBudWxsIDogc2VsZi50YWJDb250cm9sbGVyc1twcmV2aW91c0luZGV4XTtcbiAgICAgICAgICAgIGlmIChwcmV2aW91c1RhYkNvbnRyb2xsZXI/Lm9uUGF1c2UpIHtcbiAgICAgICAgICAgICAgICBwcmV2aW91c1RhYkNvbnRyb2xsZXIub25QYXVzZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsb2FkVGFiKG5ld0luZGV4LCBwcmV2aW91c0luZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZpZXcuYWRkRXZlbnRMaXN0ZW5lcigndmlld2JlZm9yZWhpZGUnLCB0aGlzLm9uUGF1c2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdmlldy5hZGRFdmVudExpc3RlbmVyKCd2aWV3YmVmb3Jlc2hvdycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIG1haW5UYWJzTWFuYWdlci5zZXRUYWJzKHZpZXcsIGN1cnJlbnRUYWJJbmRleCwgc2VsZi5nZXRUYWJzLCBnZXRUYWJDb250YWluZXJzLCBudWxsLCBvblRhYkNoYW5nZSwgZmFsc2UpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3ZpZXdzaG93JywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHNlbGYub25SZXN1bWUoZS5kZXRhaWwpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3ZpZXdkZXN0cm95Jywgb25WaWV3RGVzdHJveS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBvblJlc3VtZSgpIHtcbiAgICAgICAgdGhpcy5zZXRUaXRsZSgpO1xuICAgICAgICBjbGVhckJhY2tkcm9wKCk7XG5cbiAgICAgICAgY29uc3QgY3VycmVudFRhYkNvbnRyb2xsZXIgPSB0aGlzLmN1cnJlbnRUYWJDb250cm9sbGVyO1xuXG4gICAgICAgIGlmICghY3VycmVudFRhYkNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIG1haW5UYWJzTWFuYWdlci5zZWxlY3RlZFRhYkluZGV4KHRoaXMuaW5pdGlhbFRhYkluZGV4KTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50VGFiQ29udHJvbGxlcj8ub25SZXN1bWUpIHtcbiAgICAgICAgICAgIGN1cnJlbnRUYWJDb250cm9sbGVyLm9uUmVzdW1lKHt9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUGF1c2UoKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRUYWJDb250cm9sbGVyID0gdGhpcy5jdXJyZW50VGFiQ29udHJvbGxlcjtcblxuICAgICAgICBpZiAoY3VycmVudFRhYkNvbnRyb2xsZXI/Lm9uUGF1c2UpIHtcbiAgICAgICAgICAgIGN1cnJlbnRUYWJDb250cm9sbGVyLm9uUGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFRpdGxlKCkge1xuICAgICAgICBMaWJyYXJ5TWVudS5zZXRUaXRsZSgnJyk7XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUYWJiZWRWaWV3O1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./components/tabbedview/tabbedview.js\n\n}");

/***/ }),

/***/ "./utils/image.ts":
/*!************************!*\
  !*** ./utils/image.ts ***!
  \************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getDeviceIcon: function() { return /* binding */ getDeviceIcon; },\n/* harmony export */   getItemTypeIcon: function() { return /* binding */ getItemTypeIcon; },\n/* harmony export */   getLibraryIcon: function() { return /* binding */ getLibraryIcon; }\n/* harmony export */ });\n/* harmony import */ var _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jellyfin/sdk/lib/generated-client/models/collection-type */ \"../node_modules/@jellyfin/sdk/lib/generated-client/models/collection-type.js\");\n/* harmony import */ var _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jellyfin/sdk/lib/generated-client/models/base-item-kind */ \"../node_modules/@jellyfin/sdk/lib/generated-client/models/base-item-kind.js\");\n\n\nvar BASE_DEVICE_IMAGE_URL = 'assets/img/devices/';\n// audit note: this module is expected to return safe text for use in HTML\nfunction getWebDeviceIcon(browser) {\n    switch (browser) {\n        case 'Opera':\n        case 'Opera TV':\n        case 'Opera Android':\n            return BASE_DEVICE_IMAGE_URL + 'opera.svg';\n        case 'Chrome':\n        case 'Chrome Android':\n            return BASE_DEVICE_IMAGE_URL + 'chrome.svg';\n        case 'Firefox':\n        case 'Firefox Android':\n            return BASE_DEVICE_IMAGE_URL + 'firefox.svg';\n        case 'Safari':\n        case 'Safari iPad':\n        case 'Safari iPhone':\n            return BASE_DEVICE_IMAGE_URL + 'safari.svg';\n        case 'Edge Chromium':\n        case 'Edge Chromium Android':\n        case 'Edge Chromium iPad':\n        case 'Edge Chromium iPhone':\n            return BASE_DEVICE_IMAGE_URL + 'edgechromium.svg';\n        case 'Edge':\n            return BASE_DEVICE_IMAGE_URL + 'edge.svg';\n        case 'Internet Explorer':\n            return BASE_DEVICE_IMAGE_URL + 'msie.svg';\n        case 'Titan OS':\n            return BASE_DEVICE_IMAGE_URL + 'titanos.svg';\n        case 'Vega OS':\n            return BASE_DEVICE_IMAGE_URL + 'firetv.svg';\n        default:\n            return BASE_DEVICE_IMAGE_URL + 'html5.svg';\n    }\n}\nfunction getDeviceIcon(info) {\n    var _a;\n    switch (info.AppName || info.Client) {\n        case 'Samsung Smart TV':\n            return BASE_DEVICE_IMAGE_URL + 'samsungtv.svg';\n        case 'Xbox One':\n            return BASE_DEVICE_IMAGE_URL + 'xbox.svg';\n        case 'Sony PS4':\n            return BASE_DEVICE_IMAGE_URL + 'playstation.svg';\n        case 'Kodi':\n        case 'Kodi JellyCon':\n            return BASE_DEVICE_IMAGE_URL + 'kodi.svg';\n        case 'Jellyfin Android':\n        case 'AndroidTV':\n        case 'Android TV':\n        case 'Jellyfin Android TV':\n        case 'Jellyfin for Android':\n        case 'Jellyfin for Android TV':\n            return BASE_DEVICE_IMAGE_URL + 'android.svg';\n        case 'Jellyfin Mobile (iOS)':\n        case 'Jellyfin Mobile (iPadOS)':\n        case 'Jellyfin iOS':\n        case 'Jellyfin iPadOS':\n        case 'Jellyfin tvOS':\n        case 'Swiftfin iPadOS':\n        case 'Swiftfin iOS':\n        case 'Swiftfin tvOS':\n        case 'Infuse':\n        case 'Infuse-Direct':\n        case 'Infuse-Library':\n            return BASE_DEVICE_IMAGE_URL + 'apple.svg';\n        case 'Home Assistant':\n            return BASE_DEVICE_IMAGE_URL + 'home-assistant.svg';\n        case 'Jellyfin for WebOS':\n        case 'LG Smart TV':\n            return BASE_DEVICE_IMAGE_URL + 'webos.svg';\n        case 'Jellyfin Roku':\n            return BASE_DEVICE_IMAGE_URL + 'roku.svg';\n        case 'Jellyfin for Titan OS':\n            return BASE_DEVICE_IMAGE_URL + 'titanos.svg';\n        case 'Finamp':\n            return BASE_DEVICE_IMAGE_URL + 'finamp.svg';\n        case 'Jellyfin Web':\n            return getWebDeviceIcon(info.Name || info.DeviceName);\n        default:\n            if ((_a = info.Capabilities) === null || _a === void 0 ? void 0 : _a.IconUrl) {\n                try {\n                    return new URL(info.Capabilities.IconUrl).toString();\n                }\n                catch (err) {\n                    console.error('[getDeviceIcon] device capabilities has invalid IconUrl', info, err);\n                }\n            }\n            return BASE_DEVICE_IMAGE_URL + 'other.svg';\n    }\n}\nfunction getLibraryIcon(library) {\n    switch (library) {\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Movies:\n            return 'movie';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Music:\n            return 'music_note';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Homevideos:\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Photos:\n            return 'photo';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Livetv:\n            return 'live_tv';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Tvshows:\n            return 'tv';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Trailers:\n            return 'theaters';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Musicvideos:\n            return 'music_video';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Books:\n            return 'book';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Boxsets:\n            return 'video_library';\n        case _jellyfin_sdk_lib_generated_client_models_collection_type__WEBPACK_IMPORTED_MODULE_0__.CollectionType.Playlists:\n            return 'queue';\n        case 'channels':\n            return 'videocam';\n        case undefined:\n            return 'quiz';\n        default:\n            return 'folder';\n    }\n}\nfunction getItemTypeIcon(itemType, defaultIcon) {\n    switch (itemType) {\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.MusicAlbum:\n            return 'album';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.MusicArtist:\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Person:\n            return 'person';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Audio:\n            return 'audiotrack';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Movie:\n            return 'movie';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Episode:\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Series:\n            return 'tv';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Program:\n            return 'live_tv';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Book:\n            return 'book';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Folder:\n            return 'folder';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.BoxSet:\n            return 'video_library';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Playlist:\n            return 'queue';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.Photo:\n            return 'photo';\n        case _jellyfin_sdk_lib_generated_client_models_base_item_kind__WEBPACK_IMPORTED_MODULE_1__.BaseItemKind.PhotoAlbum:\n            return 'photo_album';\n        default:\n            return defaultIcon;\n    }\n}\n/* harmony default export */ __webpack_exports__[\"default\"] = ({\n    getDeviceIcon: getDeviceIcon,\n    getLibraryIcon: getLibraryIcon,\n    getItemTypeIcon: getItemTypeIcon\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi91dGlscy9pbWFnZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi91dGlscy9pbWFnZS50cz85MDdmIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbGxlY3Rpb25UeXBlIH0gZnJvbSAnQGplbGx5ZmluL3Nkay9saWIvZ2VuZXJhdGVkLWNsaWVudC9tb2RlbHMvY29sbGVjdGlvbi10eXBlJztcbmltcG9ydCB7IEJhc2VJdGVtS2luZCB9IGZyb20gJ0BqZWxseWZpbi9zZGsvbGliL2dlbmVyYXRlZC1jbGllbnQvbW9kZWxzL2Jhc2UtaXRlbS1raW5kJztcbnZhciBCQVNFX0RFVklDRV9JTUFHRV9VUkwgPSAnYXNzZXRzL2ltZy9kZXZpY2VzLyc7XG4vLyBhdWRpdCBub3RlOiB0aGlzIG1vZHVsZSBpcyBleHBlY3RlZCB0byByZXR1cm4gc2FmZSB0ZXh0IGZvciB1c2UgaW4gSFRNTFxuZnVuY3Rpb24gZ2V0V2ViRGV2aWNlSWNvbihicm93c2VyKSB7XG4gICAgc3dpdGNoIChicm93c2VyKSB7XG4gICAgICAgIGNhc2UgJ09wZXJhJzpcbiAgICAgICAgY2FzZSAnT3BlcmEgVFYnOlxuICAgICAgICBjYXNlICdPcGVyYSBBbmRyb2lkJzpcbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAnb3BlcmEuc3ZnJztcbiAgICAgICAgY2FzZSAnQ2hyb21lJzpcbiAgICAgICAgY2FzZSAnQ2hyb21lIEFuZHJvaWQnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICdjaHJvbWUuc3ZnJztcbiAgICAgICAgY2FzZSAnRmlyZWZveCc6XG4gICAgICAgIGNhc2UgJ0ZpcmVmb3ggQW5kcm9pZCc6XG4gICAgICAgICAgICByZXR1cm4gQkFTRV9ERVZJQ0VfSU1BR0VfVVJMICsgJ2ZpcmVmb3guc3ZnJztcbiAgICAgICAgY2FzZSAnU2FmYXJpJzpcbiAgICAgICAgY2FzZSAnU2FmYXJpIGlQYWQnOlxuICAgICAgICBjYXNlICdTYWZhcmkgaVBob25lJzpcbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAnc2FmYXJpLnN2Zyc7XG4gICAgICAgIGNhc2UgJ0VkZ2UgQ2hyb21pdW0nOlxuICAgICAgICBjYXNlICdFZGdlIENocm9taXVtIEFuZHJvaWQnOlxuICAgICAgICBjYXNlICdFZGdlIENocm9taXVtIGlQYWQnOlxuICAgICAgICBjYXNlICdFZGdlIENocm9taXVtIGlQaG9uZSc6XG4gICAgICAgICAgICByZXR1cm4gQkFTRV9ERVZJQ0VfSU1BR0VfVVJMICsgJ2VkZ2VjaHJvbWl1bS5zdmcnO1xuICAgICAgICBjYXNlICdFZGdlJzpcbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAnZWRnZS5zdmcnO1xuICAgICAgICBjYXNlICdJbnRlcm5ldCBFeHBsb3Jlcic6XG4gICAgICAgICAgICByZXR1cm4gQkFTRV9ERVZJQ0VfSU1BR0VfVVJMICsgJ21zaWUuc3ZnJztcbiAgICAgICAgY2FzZSAnVGl0YW4gT1MnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICd0aXRhbm9zLnN2Zyc7XG4gICAgICAgIGNhc2UgJ1ZlZ2EgT1MnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICdmaXJldHYuc3ZnJztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAnaHRtbDUuc3ZnJztcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0RGV2aWNlSWNvbihpbmZvKSB7XG4gICAgdmFyIF9hO1xuICAgIHN3aXRjaCAoaW5mby5BcHBOYW1lIHx8IGluZm8uQ2xpZW50KSB7XG4gICAgICAgIGNhc2UgJ1NhbXN1bmcgU21hcnQgVFYnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICdzYW1zdW5ndHYuc3ZnJztcbiAgICAgICAgY2FzZSAnWGJveCBPbmUnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICd4Ym94LnN2Zyc7XG4gICAgICAgIGNhc2UgJ1NvbnkgUFM0JzpcbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAncGxheXN0YXRpb24uc3ZnJztcbiAgICAgICAgY2FzZSAnS29kaSc6XG4gICAgICAgIGNhc2UgJ0tvZGkgSmVsbHlDb24nOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICdrb2RpLnN2Zyc7XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIEFuZHJvaWQnOlxuICAgICAgICBjYXNlICdBbmRyb2lkVFYnOlxuICAgICAgICBjYXNlICdBbmRyb2lkIFRWJzpcbiAgICAgICAgY2FzZSAnSmVsbHlmaW4gQW5kcm9pZCBUVic6XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIGZvciBBbmRyb2lkJzpcbiAgICAgICAgY2FzZSAnSmVsbHlmaW4gZm9yIEFuZHJvaWQgVFYnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICdhbmRyb2lkLnN2Zyc7XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIE1vYmlsZSAoaU9TKSc6XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIE1vYmlsZSAoaVBhZE9TKSc6XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIGlPUyc6XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIGlQYWRPUyc6XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIHR2T1MnOlxuICAgICAgICBjYXNlICdTd2lmdGZpbiBpUGFkT1MnOlxuICAgICAgICBjYXNlICdTd2lmdGZpbiBpT1MnOlxuICAgICAgICBjYXNlICdTd2lmdGZpbiB0dk9TJzpcbiAgICAgICAgY2FzZSAnSW5mdXNlJzpcbiAgICAgICAgY2FzZSAnSW5mdXNlLURpcmVjdCc6XG4gICAgICAgIGNhc2UgJ0luZnVzZS1MaWJyYXJ5JzpcbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAnYXBwbGUuc3ZnJztcbiAgICAgICAgY2FzZSAnSG9tZSBBc3Npc3RhbnQnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICdob21lLWFzc2lzdGFudC5zdmcnO1xuICAgICAgICBjYXNlICdKZWxseWZpbiBmb3IgV2ViT1MnOlxuICAgICAgICBjYXNlICdMRyBTbWFydCBUVic6XG4gICAgICAgICAgICByZXR1cm4gQkFTRV9ERVZJQ0VfSU1BR0VfVVJMICsgJ3dlYm9zLnN2Zyc7XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIFJva3UnOlxuICAgICAgICAgICAgcmV0dXJuIEJBU0VfREVWSUNFX0lNQUdFX1VSTCArICdyb2t1LnN2Zyc7XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIGZvciBUaXRhbiBPUyc6XG4gICAgICAgICAgICByZXR1cm4gQkFTRV9ERVZJQ0VfSU1BR0VfVVJMICsgJ3RpdGFub3Muc3ZnJztcbiAgICAgICAgY2FzZSAnRmluYW1wJzpcbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAnZmluYW1wLnN2Zyc7XG4gICAgICAgIGNhc2UgJ0plbGx5ZmluIFdlYic6XG4gICAgICAgICAgICByZXR1cm4gZ2V0V2ViRGV2aWNlSWNvbihpbmZvLk5hbWUgfHwgaW5mby5EZXZpY2VOYW1lKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGlmICgoX2EgPSBpbmZvLkNhcGFiaWxpdGllcykgPT09IG51bGwgfHwgX2EgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9hLkljb25VcmwpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVSTChpbmZvLkNhcGFiaWxpdGllcy5JY29uVXJsKS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tnZXREZXZpY2VJY29uXSBkZXZpY2UgY2FwYWJpbGl0aWVzIGhhcyBpbnZhbGlkIEljb25VcmwnLCBpbmZvLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBCQVNFX0RFVklDRV9JTUFHRV9VUkwgKyAnb3RoZXIuc3ZnJztcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0TGlicmFyeUljb24obGlicmFyeSkge1xuICAgIHN3aXRjaCAobGlicmFyeSkge1xuICAgICAgICBjYXNlIENvbGxlY3Rpb25UeXBlLk1vdmllczpcbiAgICAgICAgICAgIHJldHVybiAnbW92aWUnO1xuICAgICAgICBjYXNlIENvbGxlY3Rpb25UeXBlLk11c2ljOlxuICAgICAgICAgICAgcmV0dXJuICdtdXNpY19ub3RlJztcbiAgICAgICAgY2FzZSBDb2xsZWN0aW9uVHlwZS5Ib21ldmlkZW9zOlxuICAgICAgICBjYXNlIENvbGxlY3Rpb25UeXBlLlBob3RvczpcbiAgICAgICAgICAgIHJldHVybiAncGhvdG8nO1xuICAgICAgICBjYXNlIENvbGxlY3Rpb25UeXBlLkxpdmV0djpcbiAgICAgICAgICAgIHJldHVybiAnbGl2ZV90dic7XG4gICAgICAgIGNhc2UgQ29sbGVjdGlvblR5cGUuVHZzaG93czpcbiAgICAgICAgICAgIHJldHVybiAndHYnO1xuICAgICAgICBjYXNlIENvbGxlY3Rpb25UeXBlLlRyYWlsZXJzOlxuICAgICAgICAgICAgcmV0dXJuICd0aGVhdGVycyc7XG4gICAgICAgIGNhc2UgQ29sbGVjdGlvblR5cGUuTXVzaWN2aWRlb3M6XG4gICAgICAgICAgICByZXR1cm4gJ211c2ljX3ZpZGVvJztcbiAgICAgICAgY2FzZSBDb2xsZWN0aW9uVHlwZS5Cb29rczpcbiAgICAgICAgICAgIHJldHVybiAnYm9vayc7XG4gICAgICAgIGNhc2UgQ29sbGVjdGlvblR5cGUuQm94c2V0czpcbiAgICAgICAgICAgIHJldHVybiAndmlkZW9fbGlicmFyeSc7XG4gICAgICAgIGNhc2UgQ29sbGVjdGlvblR5cGUuUGxheWxpc3RzOlxuICAgICAgICAgICAgcmV0dXJuICdxdWV1ZSc7XG4gICAgICAgIGNhc2UgJ2NoYW5uZWxzJzpcbiAgICAgICAgICAgIHJldHVybiAndmlkZW9jYW0nO1xuICAgICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgICAgIHJldHVybiAncXVpeic7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gJ2ZvbGRlcic7XG4gICAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEl0ZW1UeXBlSWNvbihpdGVtVHlwZSwgZGVmYXVsdEljb24pIHtcbiAgICBzd2l0Y2ggKGl0ZW1UeXBlKSB7XG4gICAgICAgIGNhc2UgQmFzZUl0ZW1LaW5kLk11c2ljQWxidW06XG4gICAgICAgICAgICByZXR1cm4gJ2FsYnVtJztcbiAgICAgICAgY2FzZSBCYXNlSXRlbUtpbmQuTXVzaWNBcnRpc3Q6XG4gICAgICAgIGNhc2UgQmFzZUl0ZW1LaW5kLlBlcnNvbjpcbiAgICAgICAgICAgIHJldHVybiAncGVyc29uJztcbiAgICAgICAgY2FzZSBCYXNlSXRlbUtpbmQuQXVkaW86XG4gICAgICAgICAgICByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgICAgICBjYXNlIEJhc2VJdGVtS2luZC5Nb3ZpZTpcbiAgICAgICAgICAgIHJldHVybiAnbW92aWUnO1xuICAgICAgICBjYXNlIEJhc2VJdGVtS2luZC5FcGlzb2RlOlxuICAgICAgICBjYXNlIEJhc2VJdGVtS2luZC5TZXJpZXM6XG4gICAgICAgICAgICByZXR1cm4gJ3R2JztcbiAgICAgICAgY2FzZSBCYXNlSXRlbUtpbmQuUHJvZ3JhbTpcbiAgICAgICAgICAgIHJldHVybiAnbGl2ZV90dic7XG4gICAgICAgIGNhc2UgQmFzZUl0ZW1LaW5kLkJvb2s6XG4gICAgICAgICAgICByZXR1cm4gJ2Jvb2snO1xuICAgICAgICBjYXNlIEJhc2VJdGVtS2luZC5Gb2xkZXI6XG4gICAgICAgICAgICByZXR1cm4gJ2ZvbGRlcic7XG4gICAgICAgIGNhc2UgQmFzZUl0ZW1LaW5kLkJveFNldDpcbiAgICAgICAgICAgIHJldHVybiAndmlkZW9fbGlicmFyeSc7XG4gICAgICAgIGNhc2UgQmFzZUl0ZW1LaW5kLlBsYXlsaXN0OlxuICAgICAgICAgICAgcmV0dXJuICdxdWV1ZSc7XG4gICAgICAgIGNhc2UgQmFzZUl0ZW1LaW5kLlBob3RvOlxuICAgICAgICAgICAgcmV0dXJuICdwaG90byc7XG4gICAgICAgIGNhc2UgQmFzZUl0ZW1LaW5kLlBob3RvQWxidW06XG4gICAgICAgICAgICByZXR1cm4gJ3Bob3RvX2FsYnVtJztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBkZWZhdWx0SWNvbjtcbiAgICB9XG59XG5leHBvcnQgZGVmYXVsdCB7XG4gICAgZ2V0RGV2aWNlSWNvbjogZ2V0RGV2aWNlSWNvbixcbiAgICBnZXRMaWJyYXJ5SWNvbjogZ2V0TGlicmFyeUljb24sXG4gICAgZ2V0SXRlbVR5cGVJY29uOiBnZXRJdGVtVHlwZUljb25cbn07XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./utils/image.ts\n\n}");

/***/ }),

/***/ "./apps/legacy/controllers lazy recursive ^\\.\\/.*$ referencedExports: default":
/*!*****************************************************************************************************************!*\
  !*** ./apps/legacy/controllers/ lazy ^\.\/.*$ referencedExports: default chunkName: [request] namespace object ***!
  \*****************************************************************************************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

var map = {
	"./edititemmetadata": [
		"./apps/legacy/controllers/edititemmetadata.js",
		[
			"edititemmetadata"
		]
	],
	"./edititemmetadata.html": [
		"./apps/legacy/controllers/edititemmetadata.html",
		[
			"edititemmetadata-html"
		]
	],
	"./edititemmetadata.js": [
		"./apps/legacy/controllers/edititemmetadata.js",
		[
			"edititemmetadata"
		]
	],
	"./favorites": [
		"./apps/legacy/controllers/favorites.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"favorites"
		]
	],
	"./favorites.js": [
		"./apps/legacy/controllers/favorites.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"favorites"
		]
	],
	"./home": [
		"./apps/legacy/controllers/home.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"lib_scroller_index_js",
			"elements_emby-scroller_emby-scroller_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"home-js",
			"home"
		]
	],
	"./home.html": [
		"./apps/legacy/controllers/home.html",
		[
			"home-html"
		]
	],
	"./home.js": [
		"./apps/legacy/controllers/home.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"lib_scroller_index_js",
			"elements_emby-scroller_emby-scroller_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"home-js"
		]
	],
	"./hometab": [
		"./apps/legacy/controllers/hometab.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_homesections_homesections_js",
			"hometab"
		]
	],
	"./hometab.js": [
		"./apps/legacy/controllers/hometab.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_homesections_homesections_js",
			"hometab"
		]
	],
	"./itemDetails": [
		"./apps/legacy/controllers/itemDetails/index.js",
		[
			"node_modules.@babel.runtime",
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"node_modules.date-fns.esm",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"itemDetails"
		]
	],
	"./itemDetails/": [
		"./apps/legacy/controllers/itemDetails/index.js",
		[
			"node_modules.@babel.runtime",
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"node_modules.date-fns.esm",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"itemDetails"
		]
	],
	"./itemDetails/index": [
		"./apps/legacy/controllers/itemDetails/index.js",
		[
			"node_modules.@babel.runtime",
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"node_modules.date-fns.esm",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"itemDetails"
		]
	],
	"./itemDetails/index.html": [
		"./apps/legacy/controllers/itemDetails/index.html",
		[
			"itemDetails-index-html"
		]
	],
	"./itemDetails/index.js": [
		"./apps/legacy/controllers/itemDetails/index.js",
		[
			"node_modules.@babel.runtime",
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"node_modules.date-fns.esm",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"itemDetails"
		]
	],
	"./list": [
		"./apps/legacy/controllers/list.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_multiSelect_multiSelect_js",
			"components_alphaPicker_alphaPicker_js",
			"list"
		]
	],
	"./list.html": [
		"./apps/legacy/controllers/list.html",
		[
			"list-html"
		]
	],
	"./list.js": [
		"./apps/legacy/controllers/list.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_multiSelect_multiSelect_js",
			"components_alphaPicker_alphaPicker_js",
			"list"
		]
	],
	"./livetv.html": [
		"./apps/legacy/controllers/livetv.html",
		[
			"livetv-html"
		]
	],
	"./livetv/livetvchannels": [
		"./apps/legacy/controllers/livetv/livetvchannels.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"livetv-livetvchannels"
		]
	],
	"./livetv/livetvchannels.js": [
		"./apps/legacy/controllers/livetv/livetvchannels.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"livetv-livetvchannels"
		]
	],
	"./livetv/livetvguide": [
		"./apps/legacy/controllers/livetv/livetvguide.js",
		[
			"components_images_imageLoader_js",
			"components_shortcuts_js",
			"lib_scroller_index_js",
			"elements_emby-scroller_emby-scroller_js",
			"elements_emby-tabs_emby-tabs_js",
			"components_guide_guide_js",
			"livetv-livetvguide"
		]
	],
	"./livetv/livetvguide.js": [
		"./apps/legacy/controllers/livetv/livetvguide.js",
		[
			"components_images_imageLoader_js",
			"components_shortcuts_js",
			"lib_scroller_index_js",
			"elements_emby-scroller_emby-scroller_js",
			"elements_emby-tabs_emby-tabs_js",
			"components_guide_guide_js",
			"livetv-livetvguide"
		]
	],
	"./livetv/livetvrecordings": [
		"./apps/legacy/controllers/livetv/livetvrecordings.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"livetv-livetvrecordings"
		]
	],
	"./livetv/livetvrecordings.js": [
		"./apps/legacy/controllers/livetv/livetvrecordings.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"livetv-livetvrecordings"
		]
	],
	"./livetv/livetvschedule": [
		"./apps/legacy/controllers/livetv/livetvschedule.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"livetv-livetvschedule"
		]
	],
	"./livetv/livetvschedule.js": [
		"./apps/legacy/controllers/livetv/livetvschedule.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"livetv-livetvschedule"
		]
	],
	"./livetv/livetvseriestimers": [
		"./apps/legacy/controllers/livetv/livetvseriestimers.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"livetv-livetvseriestimers"
		]
	],
	"./livetv/livetvseriestimers.js": [
		"./apps/legacy/controllers/livetv/livetvseriestimers.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"livetv-livetvseriestimers"
		]
	],
	"./livetv/livetvsuggested": [
		"./apps/legacy/controllers/livetv/livetvsuggested.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-tabs_emby-tabs_js",
			"livetv-livetvsuggested"
		]
	],
	"./livetv/livetvsuggested.js": [
		"./apps/legacy/controllers/livetv/livetvsuggested.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-tabs_emby-tabs_js",
			"livetv-livetvsuggested"
		]
	],
	"./lyrics": [
		"./apps/legacy/controllers/lyrics.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"lyrics"
		]
	],
	"./lyrics.html": [
		"./apps/legacy/controllers/lyrics.html",
		[
			"lyrics-html"
		]
	],
	"./lyrics.js": [
		"./apps/legacy/controllers/lyrics.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"lyrics"
		]
	],
	"./movies/moviecollections": [
		"./apps/legacy/controllers/movies/moviecollections.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_alphaPicker_alphaPicker_js",
			"movies-moviecollections"
		]
	],
	"./movies/moviecollections.js": [
		"./apps/legacy/controllers/movies/moviecollections.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_alphaPicker_alphaPicker_js",
			"movies-moviecollections"
		]
	],
	"./movies/moviegenres": [
		"./apps/legacy/controllers/movies/moviegenres.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"movies-moviegenres"
		]
	],
	"./movies/moviegenres.js": [
		"./apps/legacy/controllers/movies/moviegenres.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"movies-moviegenres"
		]
	],
	"./movies/movies": [
		"./apps/legacy/controllers/movies/movies.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"movies-movies"
		]
	],
	"./movies/movies.html": [
		"./apps/legacy/controllers/movies/movies.html",
		[
			"movies-movies-html"
		]
	],
	"./movies/movies.js": [
		"./apps/legacy/controllers/movies/movies.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"movies-movies"
		]
	],
	"./movies/moviesrecommended": [
		"./apps/legacy/controllers/movies/moviesrecommended.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"movies-moviesrecommended"
		]
	],
	"./movies/moviesrecommended.js": [
		"./apps/legacy/controllers/movies/moviesrecommended.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"movies-moviesrecommended"
		]
	],
	"./music/music.html": [
		"./apps/legacy/controllers/music/music.html",
		[
			"music-music-html"
		]
	],
	"./music/musicalbums": [
		"./apps/legacy/controllers/music/musicalbums.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"music-musicalbums"
		]
	],
	"./music/musicalbums.js": [
		"./apps/legacy/controllers/music/musicalbums.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"music-musicalbums"
		]
	],
	"./music/musicartists": [
		"./apps/legacy/controllers/music/musicartists.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"music-musicartists"
		]
	],
	"./music/musicartists.js": [
		"./apps/legacy/controllers/music/musicartists.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"music-musicartists"
		]
	],
	"./music/musicgenres": [
		"./apps/legacy/controllers/music/musicgenres.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"music-musicgenres"
		]
	],
	"./music/musicgenres.js": [
		"./apps/legacy/controllers/music/musicgenres.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"music-musicgenres"
		]
	],
	"./music/musicplaylists": [
		"./apps/legacy/controllers/music/musicplaylists.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"music-musicplaylists"
		]
	],
	"./music/musicplaylists.js": [
		"./apps/legacy/controllers/music/musicplaylists.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"music-musicplaylists"
		]
	],
	"./music/musicrecommended": [
		"./apps/legacy/controllers/music/musicrecommended.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"music-musicrecommended"
		]
	],
	"./music/musicrecommended.js": [
		"./apps/legacy/controllers/music/musicrecommended.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"music-musicrecommended"
		]
	],
	"./music/songs": [
		"./apps/legacy/controllers/music/songs.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"music-songs"
		]
	],
	"./music/songs.js": [
		"./apps/legacy/controllers/music/songs.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"music-songs"
		]
	],
	"./playback/queue": [
		"./apps/legacy/controllers/playback/queue/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-queue"
		]
	],
	"./playback/queue/": [
		"./apps/legacy/controllers/playback/queue/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-queue"
		]
	],
	"./playback/queue/index": [
		"./apps/legacy/controllers/playback/queue/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-queue"
		]
	],
	"./playback/queue/index.html": [
		"./apps/legacy/controllers/playback/queue/index.html",
		[
			"playback-queue-index-html"
		]
	],
	"./playback/queue/index.js": [
		"./apps/legacy/controllers/playback/queue/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"components_itemContextMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-queue"
		]
	],
	"./playback/video": [
		"./apps/legacy/controllers/playback/video/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_mediainfo_mediainfo_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-video"
		]
	],
	"./playback/video/": [
		"./apps/legacy/controllers/playback/video/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_mediainfo_mediainfo_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-video"
		]
	],
	"./playback/video/index": [
		"./apps/legacy/controllers/playback/video/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_mediainfo_mediainfo_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-video"
		]
	],
	"./playback/video/index.html": [
		"./apps/legacy/controllers/playback/video/index.html",
		[
			"playback-video-index-html"
		]
	],
	"./playback/video/index.js": [
		"./apps/legacy/controllers/playback/video/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.headroom.js",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_mediainfo_mediainfo_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"elements_emby-slider_emby-slider_js",
			"playback-video"
		]
	],
	"./session/addServer": [
		"./apps/legacy/controllers/session/addServer/index.js",
		[
			"session-addServer"
		]
	],
	"./session/addServer/": [
		"./apps/legacy/controllers/session/addServer/index.js",
		[
			"session-addServer"
		]
	],
	"./session/addServer/index": [
		"./apps/legacy/controllers/session/addServer/index.js",
		[
			"session-addServer"
		]
	],
	"./session/addServer/index.html": [
		"./apps/legacy/controllers/session/addServer/index.html",
		[
			"session-addServer-index-html"
		]
	],
	"./session/addServer/index.js": [
		"./apps/legacy/controllers/session/addServer/index.js",
		[
			"session-addServer"
		]
	],
	"./session/login": [
		"./apps/legacy/controllers/session/login/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-login"
		]
	],
	"./session/login/": [
		"./apps/legacy/controllers/session/login/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-login"
		]
	],
	"./session/login/index": [
		"./apps/legacy/controllers/session/login/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-login"
		]
	],
	"./session/login/index.html": [
		"./apps/legacy/controllers/session/login/index.html",
		[
			"session-login-index-html"
		]
	],
	"./session/login/index.js": [
		"./apps/legacy/controllers/session/login/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"node_modules.headroom.js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-login"
		]
	],
	"./session/login/login.scss": [
		"./apps/legacy/controllers/session/login/login.scss",
		[
			"session-login-login-scss"
		]
	],
	"./session/resetPassword": [
		"./apps/legacy/controllers/session/resetPassword/index.js",
		[
			"session-resetPassword"
		]
	],
	"./session/resetPassword/": [
		"./apps/legacy/controllers/session/resetPassword/index.js",
		[
			"session-resetPassword"
		]
	],
	"./session/resetPassword/index": [
		"./apps/legacy/controllers/session/resetPassword/index.js",
		[
			"session-resetPassword"
		]
	],
	"./session/resetPassword/index.html": [
		"./apps/legacy/controllers/session/resetPassword/index.html",
		[
			"session-resetPassword-index-html"
		]
	],
	"./session/resetPassword/index.js": [
		"./apps/legacy/controllers/session/resetPassword/index.js",
		[
			"session-resetPassword"
		]
	],
	"./session/selectServer": [
		"./apps/legacy/controllers/session/selectServer/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-selectServer"
		]
	],
	"./session/selectServer/": [
		"./apps/legacy/controllers/session/selectServer/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-selectServer"
		]
	],
	"./session/selectServer/index": [
		"./apps/legacy/controllers/session/selectServer/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-selectServer"
		]
	],
	"./session/selectServer/index.html": [
		"./apps/legacy/controllers/session/selectServer/index.html",
		[
			"session-selectServer-index-html"
		]
	],
	"./session/selectServer/index.js": [
		"./apps/legacy/controllers/session/selectServer/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"session-selectServer"
		]
	],
	"./shows/episodes": [
		"./apps/legacy/controllers/shows/episodes.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"shows-episodes"
		]
	],
	"./shows/episodes.js": [
		"./apps/legacy/controllers/shows/episodes.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"shows-episodes"
		]
	],
	"./shows/tvgenres": [
		"./apps/legacy/controllers/shows/tvgenres.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"shows-tvgenres"
		]
	],
	"./shows/tvgenres.js": [
		"./apps/legacy/controllers/shows/tvgenres.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"shows-tvgenres"
		]
	],
	"./shows/tvrecommended": [
		"./apps/legacy/controllers/shows/tvrecommended.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"shows-tvrecommended"
		]
	],
	"./shows/tvrecommended.html": [
		"./apps/legacy/controllers/shows/tvrecommended.html",
		[
			"shows-tvrecommended-html"
		]
	],
	"./shows/tvrecommended.js": [
		"./apps/legacy/controllers/shows/tvrecommended.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.headroom.js",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-tabs_emby-tabs_js",
			"syncPlay-ui-settings-SettingsEditor",
			"syncPlay-ui-groupSelectionMenu",
			"scripts_libraryMenu_js",
			"shows-tvrecommended"
		]
	],
	"./shows/tvshows": [
		"./apps/legacy/controllers/shows/tvshows.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"shows-tvshows"
		]
	],
	"./shows/tvshows.js": [
		"./apps/legacy/controllers/shows/tvshows.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"node_modules.markdown-it",
			"node_modules.entities",
			"node_modules.linkify-it",
			"node_modules.punycode.js",
			"node_modules.mdurl",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"components_mediainfo_mediainfo_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"components_alphaPicker_style_scss",
			"components_listview_listview_js-node_modules_uc_micro_index_mjs",
			"components_filterdialog_filterIndicator_js-scripts_libraryBrowser_js",
			"components_alphaPicker_alphaPicker_js",
			"shows-tvshows"
		]
	],
	"./shows/tvstudios": [
		"./apps/legacy/controllers/shows/tvstudios.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"shows-tvstudios"
		]
	],
	"./shows/tvstudios.js": [
		"./apps/legacy/controllers/shows/tvstudios.js",
		[
			"node_modules.@jellyfin.sdk",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"shows-tvstudios"
		]
	],
	"./shows/tvupcoming": [
		"./apps/legacy/controllers/shows/tvupcoming.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"shows-tvupcoming"
		]
	],
	"./shows/tvupcoming.js": [
		"./apps/legacy/controllers/shows/tvupcoming.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"components_shortcuts_js",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"shows-tvupcoming"
		]
	],
	"./user/controls": [
		"./apps/legacy/controllers/user/controls/index.js",
		[
			"user-controls"
		]
	],
	"./user/controls/": [
		"./apps/legacy/controllers/user/controls/index.js",
		[
			"user-controls"
		]
	],
	"./user/controls/index": [
		"./apps/legacy/controllers/user/controls/index.js",
		[
			"user-controls"
		]
	],
	"./user/controls/index.html": [
		"./apps/legacy/controllers/user/controls/index.html",
		[
			"user-controls-index-html"
		]
	],
	"./user/controls/index.js": [
		"./apps/legacy/controllers/user/controls/index.js",
		[
			"user-controls"
		]
	],
	"./user/display": [
		"./apps/legacy/controllers/user/display/index.js",
		[
			"node_modules.@mui.material",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-display-index-tsx",
			"user-display"
		]
	],
	"./user/display/": [
		"./apps/legacy/controllers/user/display/index.js",
		[
			"node_modules.@mui.material",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-display-index-tsx",
			"user-display"
		]
	],
	"./user/display/index": [
		"./apps/legacy/controllers/user/display/index.js",
		[
			"node_modules.@mui.material",
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-display-index-tsx",
			"user-display"
		]
	],
	"./user/display/index.html": [
		"./apps/legacy/controllers/user/display/index.html",
		[
			"user-display-index-html"
		]
	],
	"./user/display/index.js": [
		"./apps/legacy/controllers/user/display/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-display",
			"user-display-index-js"
		]
	],
	"./user/home": [
		"./apps/legacy/controllers/user/home/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_homesections_homesections_js",
			"user-home"
		]
	],
	"./user/home/": [
		"./apps/legacy/controllers/user/home/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_homesections_homesections_js",
			"user-home"
		]
	],
	"./user/home/index": [
		"./apps/legacy/controllers/user/home/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_homesections_homesections_js",
			"user-home"
		]
	],
	"./user/home/index.html": [
		"./apps/legacy/controllers/user/home/index.html",
		[
			"user-home-index-html"
		]
	],
	"./user/home/index.js": [
		"./apps/legacy/controllers/user/home/index.js",
		[
			"node_modules.@jellyfin.sdk",
			"node_modules.sortablejs",
			"components_images_imageLoader_js",
			"components_cardbuilder_utils_builder_ts",
			"elements_emby-select_emby-select_js",
			"components_shortcuts_js",
			"components_actionSheet_actionSheet_ts",
			"components_indicators_indicators_js-components_guide_programs_scss",
			"components_cardbuilder_cardBuilder_js",
			"lib_scroller_index_js",
			"elements_emby-itemscontainer_emby-itemscontainer_js",
			"elements_emby-scroller_emby-scroller_js",
			"components_homesections_homesections_js",
			"user-home"
		]
	],
	"./user/playback": [
		"./apps/legacy/controllers/user/playback/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-playback"
		]
	],
	"./user/playback/": [
		"./apps/legacy/controllers/user/playback/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-playback"
		]
	],
	"./user/playback/index": [
		"./apps/legacy/controllers/user/playback/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-playback"
		]
	],
	"./user/playback/index.html": [
		"./apps/legacy/controllers/user/playback/index.html",
		[
			"user-playback-index-html"
		]
	],
	"./user/playback/index.js": [
		"./apps/legacy/controllers/user/playback/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"user-playback"
		]
	],
	"./user/subtitles": [
		"./apps/legacy/controllers/user/subtitles/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"elements_emby-slider_emby-slider_js",
			"user-subtitles"
		]
	],
	"./user/subtitles/": [
		"./apps/legacy/controllers/user/subtitles/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"elements_emby-slider_emby-slider_js",
			"user-subtitles"
		]
	],
	"./user/subtitles/index": [
		"./apps/legacy/controllers/user/subtitles/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"elements_emby-slider_emby-slider_js",
			"user-subtitles"
		]
	],
	"./user/subtitles/index.html": [
		"./apps/legacy/controllers/user/subtitles/index.html",
		[
			"user-subtitles-index-html"
		]
	],
	"./user/subtitles/index.js": [
		"./apps/legacy/controllers/user/subtitles/index.js",
		[
			"elements_emby-select_emby-select_js",
			"components_actionSheet_actionSheet_ts",
			"elements_emby-slider_emby-slider_js",
			"user-subtitles"
		]
	]
};
function webpackAsyncContext(req) {
	try {
		if(!__webpack_require__.o(map, req)) {
			return Promise.resolve().then(function() {
	var e = new Error("Cannot find module '" + req + "'");
	e.code = 'MODULE_NOT_FOUND';
	throw e;
});
		}
	} catch(err) {
		return Promise.reject(err);
	}

	var ids = map[req], id = ids[0];
	return Promise.all(ids[1].map(__webpack_require__.e)).then(function() { return __webpack_require__(id); });
}
webpackAsyncContext.keys = function() { return Object.keys(map); };
webpackAsyncContext.id = "./apps/legacy/controllers lazy recursive ^\\.\\/.*$ referencedExports: default";
module.exports = webpackAsyncContext;

/***/ })

}]);