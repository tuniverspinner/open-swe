import jwt from "jsonwebtoken";

// eslint-disable-next-line no-console
console.log(jwt.sign({ sub: "123" }, process.env.JWT_SECRET_KEY!));
