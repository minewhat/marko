var componentsUtil = require("./util");
var componentLookup = componentsUtil.a_;
var emitLifecycleEvent = componentsUtil.b_;

var ComponentsContext = require("./ComponentsContext");
var getComponentsContext = ComponentsContext.__;
var registry = require("./registry");
var copyProps = require("raptor-util/copyProps");
var isServer = componentsUtil.ab_ === true;
var beginComponent = require("./beginComponent");
var endComponent = require("./endComponent");

var COMPONENT_BEGIN_ASYNC_ADDED_KEY = "$wa";

function resolveComponentKey(globalComponentsContext, key, parentComponentDef) {
    if (key[0] === "#") {
        return key.substring(1);
    } else {
        return parentComponentDef.id + "-" + parentComponentDef._h_(key);
    }
}

function handleBeginAsync(event) {
    var parentOut = event.parentOut;
    var asyncOut = event.out;
    var componentsContext = parentOut._r_;

    if (componentsContext !== undefined) {
        // We are going to start a nested ComponentsContext
        asyncOut._r_ = new ComponentsContext(asyncOut, componentsContext);
    }
    // Carry along the component arguments
    asyncOut.c(parentOut._Z_, parentOut.aa_, parentOut.a__);
}

function createRendererFunc(templateRenderFunc, componentProps, renderingLogic) {
    renderingLogic = renderingLogic || {};
    var onInput = renderingLogic.onInput;
    var typeName = componentProps._l_;
    var isSplit = componentProps._Y_ === true;
    var isImplicitComponent = componentProps.ae_ === true;

    var shouldApplySplitMixins = isSplit;

    return function renderer(input, out) {
        var outGlobal = out.global;

        if (out.isSync() === false) {
            if (!outGlobal[COMPONENT_BEGIN_ASYNC_ADDED_KEY]) {
                outGlobal[COMPONENT_BEGIN_ASYNC_ADDED_KEY] = true;
                out.on("beginAsync", handleBeginAsync);
            }
        }

        var componentsContext = getComponentsContext(out);
        var globalComponentsContext = componentsContext.P_;

        var component = globalComponentsContext.Q_;
        var isRerender = component !== undefined;
        var id;
        var isExisting;
        var customEvents;
        var scope;
        var parentComponentDef = componentsContext._p_;
        var componentDefFromArgs = out._Z_;

        if (component) {
            // If component is provided then we are currently rendering
            // the top-level UI component as part of a re-render
            id = component.id; // We will use the ID of the component being re-rendered
            isExisting = true; // This is a re-render so we know the component is already in the DOM
            globalComponentsContext.Q_ = null;
        } else {
            // Otherwise, we are rendering a nested UI component. We will need
            // to match up the UI component with the component already in the
            // DOM (if any) so we will need to resolve the component ID from
            // the assigned key. We also need to handle any custom event bindings
            // that were provided.
            if (componentDefFromArgs) {
                // console.log('componentArgs:', componentArgs);
                scope = componentDefFromArgs.id;
                out._Z_ = null;

                customEvents = out.a__;
                var key = out.aa_;

                if (key != null) {
                    id = resolveComponentKey(globalComponentsContext, key.toString(), componentDefFromArgs);
                } else {
                    id = componentDefFromArgs._k_();
                }
            } else {
                id = globalComponentsContext._k_();
            }
        }

        if (isServer) {
            // If we are rendering on the server then things are simplier since
            // we don't need to match up the UI component with a previously
            // rendered component already mounted to the DOM. We also create
            // a lightweight ServerComponent
            component = registry._n_(renderingLogic, id, input, out, typeName, customEvents, scope);

            // This is the final input after running the lifecycle methods.
            // We will be passing the input to the template for the `input` param
            input = component._C_;

            component._C_ = undefined; // We don't want ___updatedInput to be serialized to the browser
        } else {
            if (!component) {
                if (isRerender && (component = componentLookup[id]) && component._l_ !== typeName) {
                    // Destroy the existing component since
                    component.destroy();
                    component = undefined;
                }

                if (component) {
                    isExisting = true;
                } else {
                    isExisting = false;
                    // We need to create a new instance of the component
                    component = registry._n_(typeName, id);

                    if (shouldApplySplitMixins === true) {
                        shouldApplySplitMixins = false;

                        var renderingLogicProps = typeof renderingLogic == "function" ? renderingLogic.prototype : renderingLogic;

                        copyProps(renderingLogicProps, component.constructor.prototype);
                    }
                }

                // Set this flag to prevent the component from being queued for update
                // based on the new input. The component is about to be rerendered
                // so we don't want to queue it up as a result of calling `setInput()`
                component.s_ = true;

                if (customEvents !== undefined) {
                    component.W_(customEvents, scope);
                }

                if (isExisting === false) {
                    emitLifecycleEvent(component, "create", input, out);
                }

                input = component.H_(input, onInput, out);

                if (isExisting === true) {
                    if (component.J_ === false || component.shouldUpdate(input, component.g_) === false) {
                        // We put a placeholder element in the output stream to ensure that the existing
                        // DOM node is matched up correctly when using morphdom. We flag the VElement
                        // node to track that it is a preserve marker
                        out.af_(component);
                        globalComponentsContext._z_[id] = true;
                        component.e_(); // The component is no longer dirty so reset internal flags
                        return;
                    }
                }
            }

            component.q_ = outGlobal;

            emitLifecycleEvent(component, "render", out);
        }

        var componentDef = beginComponent(componentsContext, component, isSplit, componentDefFromArgs, isImplicitComponent);

        componentDef._c_ = isExisting;

        // Render the template associated with the component using the final template
        // data that we constructed
        templateRenderFunc(input, out, componentDef, component, component.U_);

        endComponent(out, componentDef);
        componentsContext._p_ = parentComponentDef;
    };
}

module.exports = createRendererFunc;

// exports used by the legacy renderer
createRendererFunc._W_ = resolveComponentKey;
createRendererFunc._X_ = handleBeginAsync;