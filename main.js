require("dotenv").config()
const fs = require("fs");
const DOMParser = new (require("jsdom").JSDOM)().window.DOMParser;

console.assert(process.env.innovator !== null, "Please provide innovator variablename as environment variable `innovator`");
const INN = process.env.innovator;

console.assert(process.env.aml, "Please provide input aml filepath as environment variable `aml`");
const inputAml = process.env.aml;
const parsed = new DOMParser().parseFromString(fs.readFileSync(inputAml, { encoding: 'utf-8' }), "text/xml");

function makeProperty(parentItemVarname, propelement, result, varnameset) {
    if (propelement.children.length === 0) {
        return { varName: null, content: propelement.innerHTML };
    }
    console.assert(propelement.children.length === 1, "Property tag can have only one child element");
    console.assert(propelement.children[0].tagName === "Item", "Property tag can only contain <Item> tag");

    const element = propelement.children[0]; // Item inside prop
    const varName = varnameset.getNew(`${parentItemVarname}_${propelement.tagName}`);
    makeItem(varName, element, result);
    return { varName, content: null };
}

function makeRelationships(parentItemVarname, relelement, result) {
    const relVarNames = [];
    for (let i = 0; i < relelement.children.length; i++) {
        console.assert(relelement.children[i].tagName === "Item", "<Relationships> can only contain <Item> tags");
        const itemVarName = varnameset.getNew(`${parentItemVarname}_rel_${relelement.children[i].getAttribute("type") || relelement.children[i].getAttribute("typeId")}`);
        makeItem(itemVarName, relelement.children[i], result);
        relVarNames.push(itemVarName);
    }
    return { relVarNames };
}

function makeItem(varName, element, result, varnameset) {
    console.assert(element.getAttribute("type") !== null || element.getAttribute("typeId") !== null, "Either type or typeId should exist on <Item>");

    // Item variable declaration
    result.push(`const ${varName} = ${INN}.newItem(${[element.getAttribute("type"), element.getAttribute("action")].map(param => param ? `"${param}"` : "undefined").join(", ")});`);

    // Assign attributes
    for (let i = 0; i < element.attributes.length; i++) {
        if (element.attributes[i].name === "type" || element.attributes[i].name === "action") continue;
        result.push(`${varName}.setAttribute("${element.attributes[i].name}", "${element.attributes[i].value}");`)
    }

    // Traverse children
    for (let i = 0; i < element.children.length; i++) {
        // Relationships
        if (element.children[i].tagName === "Relationships") {
            const { relVarNames } = makeRelationships(varName, element.children[i], result, varnameset);
            for (let i = 0; i < relVarNames.length; i++) {
                result.push(`${varName}.addRelationship(${relVarNames[i]});`);
            }
            continue;
        }

        const propResult = makeProperty(varName, element.children[i], result, varnameset);
        if (propResult.content) {
            result.push(`${varName}.setProperty("${element.children[i].tagName}", "${propResult.content}");`);
        } else if (propResult.varName) {
            result.push(`${varName}.setPropertyItem("${element.children[i].tagName}", ${propResult.varName});`)
        } else {
            console.assert(false, "makeProperty should return either content or varName");
        }
    }

    return {};
}

function makeAML(amlelem) {
    const result = [];
    const varnameset = {
        getNew: (name) => {
            name = name.replaceAll(/\s+/g, "_");
            if (varnameset[name]) {
                varnameset[name] += 1;
                return `${name}_${varnameset[name]}`
            }
            varnameset[name] = 1;
            return `${name}`;
        }
    };

    console.assert(amlelem.tagName === "AML", "Need <AML> tag at root level");
    
    for (let i = 0; i < amlelem.children.length; i++) {
        console.assert(amlelem.children[i].tagName === "Item", "<AML> tag can only contain <Item> tags");

        const itemVarName = varnameset.getNew(`item_${amlelem.children[i].getAttribute("type") || amlelem.children[i].getAttribute("typeId")}`);
        makeItem(itemVarName, amlelem.children[i], result, varnameset);
        result.push("");
    }
    return result;
}


const result = makeAML(parsed.children[0]);
// result.push(`item.apply().dom.documentElement;`);
console.log(result.join('\n'));