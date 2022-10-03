document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.querySelector('textarea[name=source]');
    textarea.addEventListener('input', (e) => {
        refreshOutput(e.target.value);
    });

    refreshOutput(textarea.value);
});

function refreshOutput(html) {
    const output = document.querySelector('pp-output');
    output.innerText = '';

    output.appendChild(prettyPrint(prettyParse(html)));
}

class Lexer {
    constructor(source) {
        //store in a property
        this.source = source;
        this.file_pointer = 0;
    }

    //read character by character
    read() {
        if(this.file_pointer < 0 || this.file_pointer >= this.source.length) {
            return undefined;
        }

        return this.source[this.file_pointer++];
    }

    //restore/reset file pointer to 0
    rewind() {
        this.file_pointer = 0;
    }

    //search remainder for token, if equals 0 then its a match
    match(token) {
        return this.remainder.search(token) === 0;
    }

    consumeMatch(token) {
        const match = this.remainder.match(token);

        if(match && match.length && match.index == 0) {
            this.file_pointer += match[0].length;

            return true;
        }
        
        return false;
       
    }

    readUntil(condition) {
        const start_pointer = this.file_pointer;

        while (!this.endoffile && !condition(this)) {
            this.file_pointer++;
        }

        return this.source.substring(start_pointer, this.file_pointer);
    }

    //read identifier until we match a non-word character
    readIdentifier() {
        return this.readUntil((lexer) => !lexer.match(/\w/));
    }

    skipWhitespace() {
        return this.readUntil((lexer) => !lexer.match(/\s/));
    }

    get endoffile() {
        return this.file_pointer >= this.source.length;
    }

    //returns the text that remains to be read from our file
    get remainder() {
        return this.source.substring(this.file_pointer);
    }
}

function prettyParse(html) {
    const lexer = new Lexer(html);

    function parseComment() {
        const commentText = lexer.readUntil((lexer) => lexer.match('-->'));
        lexer.consumeMatch('-->');

        return document.createComment(commentText);
    }

    function parseAttribute() {
        const attrName = lexer.readIdentifier();
        const attr = document.createAttribute(attrName);

        if (lexer.consumeMatch(/\s*=\s*/)) {
            let value;

            if (lexer.match(/['"]/)) {
                const closingChar = lexer.read();

                value = lexer.readUntil((lexer) => lexer.match(closingChar));
                lexer.consumeMatch(closingChar);
            } else {
                value = lexer.readUntil((lexer) => lexer.match(/[\s\/>]/));
            }

            attr.value = value;
        }

        return attr;
    }

    function parseElement() {
        const voidElements = ['area', 'base', 'br', 'col', 'command', 
            'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 
            'param', 'source', 'track','wbr'
        ];
        const tagName = lexer.readIdentifier();
        const element = document.createElement(tagName);

        // !!!TBT parse attributes
        //attribute parsing loop

        lexer.skipWhitespace();
        while(!lexer.endoffile && !lexer.match(/\/?>/)) { //an optional forward slash followed by a greater than sign
            element.setAttributeNode(parseAttribute()); //returns the attribute in the form of a node - name and value
            lexer.skipWhitespace();
        }

        // console.log(lexer.readUntil((lexer) => lexer.match(/\/?>/)));

        if(lexer.consumeMatch('>')) {
            if(!voidElements.includes(tagName)) {
                element.appendChild(parseContent());
    
                lexer.consumeMatch('</');
                lexer.readUntil((lexer) => lexer.consumeMatch('>'));
            }
        } else {
            lexer.consumeMatch('/>');
        }

        return element;
    }

    //parse any sequence of html given
    function parseContent() {
        let text = '';
        const fragment = document.createDocumentFragment();

        function flushText() {
            if(text.length) {
                fragment.appendChild(document.createTextNode(text));
                text = '';
            }
        }

        while(!lexer.endoffile && !lexer.match('</')) {
            if(lexer.consumeMatch('<!--')) {
                flushText();
                fragment.appendChild(parseComment());
            } else if(lexer.consumeMatch('<')) {
                flushText();
                fragment.appendChild(parseElement());
            } else {
                text += lexer.read();
            }
        }

        flushText();

        return fragment;
    }

    return parseContent();
}

function prettyPrint(node) {
    function printChildNodes(node) {
        const fragment = document.createDocumentFragment();

        node.childNodes.forEach((child) => {
            fragment.appendChild(prettyPrint(child));
        });

        return fragment;
    }

    switch (node.nodeType) {
        case Node.COMMENT_NODE: {
            const comment = document.createElement('pp-comment');
            comment.innerText = node.nodeValue;

            return comment;
        }

        case Node.DOCUMENT_FRAGMENT_NODE: {
            return printChildNodes(node);
        }

        case Node.ELEMENT_NODE: {
            const element = document.createElement('pp-element');
            const openTag = document.createElement('pp-opentag'); 

            const tagName = document.createElement('pp-tagname');
            tagName.innerText = node.nodeName.toLowerCase();
            openTag.appendChild(tagName); 

            Array.from(node.attributes).forEach((attr) => {
                openTag.appendChild(prettyPrint(attr));
            });

            element.appendChild(openTag);

            if(node.hasChildNodes()) {
                element.appendChild(printChildNodes(node));
                const closeTag = document.createElement('pp-closetag');
                closeTag.appendChild(tagName.cloneNode(true));
                element.appendChild(closeTag);
            } else {
                openTag.classList.add('empty');
            }

            return element;

        }

        case Node.ATTRIBUTE_NODE: {
            const attribute = document.createElement('pp-attribute');
            const attrName = document.createElement('pp-attrname');

            attrName.innerText = node.nodeName.toLowerCase();
            attribute.appendChild(attrName);

            if(node.nodeValue !== '') {
                const attrValue = document.createElement('pp-attrvalue');
                attrValue.innerText = node.nodeValue;
                attribute.appendChild(attrValue);
            }
        }

        case Node.TEXT_NODE: {
            const text = document.createElement('pp-text');
            text.innerText = node.nodeValue;

            return text;
        }   
    }

    return node.cloneNode(true);
}
