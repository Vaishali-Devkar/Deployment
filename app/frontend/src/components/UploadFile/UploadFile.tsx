import React, { useState, ChangeEvent } from "react";
import { Callout, Label, Text } from "@fluentui/react";
import { Button } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular } from "@fluentui/react-icons";
import { useMsal } from "@azure/msal-react";
import { useTranslation } from "react-i18next";

import { SimpleAPIResponse, uploadFileApi, deleteUploadedFileApi, listUploadedFilesApi } from "../../api";
import { useLogin, getToken } from "../../authConfig";
import styles from "./UploadFile.module.css";

interface Props {
    className?: string;
    disabled?: boolean;
}

export const UploadFile: React.FC<Props> = ({ className, disabled }: Props) => {
    // State variables to manage the component behavior
    const [isCalloutVisible, setIsCalloutVisible] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [deletionStatus, setDeletionStatus] = useState<{ [filename: string]: "pending" | "error" | "success" }>({});
    const [uploadedFile, setUploadedFile] = useState<SimpleAPIResponse>();
    const [uploadedFileError, setUploadedFileError] = useState<string>();
    //const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string; is_group: boolean }[]>([]);
    const [isGroupAccess, setIsGroupAccess] = useState<boolean>(false);
    const { t } = useTranslation();

    if (!useLogin) {
        throw new Error("The UploadFile component requires useLogin to be true");
    }

    const client = useMsal().instance;

    // Handler for the "Manage file uploads" button
    const handleButtonClick = async () => {
        setIsCalloutVisible(!isCalloutVisible); // Toggle the Callout visibility

        // Update uploaded files by calling the API
        try {
            const idToken = await getToken(client);
            if (!idToken) {
                throw new Error("No authentication token available");
            }
            listUploadedFiles(idToken);
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
    };

    const listUploadedFiles = async (idToken: string) => {
        listUploadedFilesApi(idToken).then(files => {
            setIsLoading(false);
            setDeletionStatus({});
            //setUploadedFiles(files);
            // Transform each filename into an object with name and is_group
        const transformedFiles = files.map((filename: string) => {
            const is_group = filename.startsWith("[grp]_");
            return {
                name: is_group ? filename.slice(7) : filename,
                is_group
            };
        });

        setUploadedFiles(transformedFiles);
        });
    };

    const handleRemoveFile = async (filename: string) => {
        setDeletionStatus({ ...deletionStatus, [filename]: "pending" });

        try {
            const idToken = await getToken(client);
            if (!idToken) {
                throw new Error("No authentication token available");
            }

            await deleteUploadedFileApi(filename, idToken);
            setDeletionStatus({ ...deletionStatus, [filename]: "success" });
            listUploadedFiles(idToken);
        } catch (error) {
            setDeletionStatus({ ...deletionStatus, [filename]: "error" });
            console.error(error);
        }
    };

    // Handler for the form submission (file upload)
    const handleUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (!e.target.files || e.target.files.length === 0) {
            return;
        }
        setIsUploading(true); // Start the loading state
        const file: File = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("groupAccess", isGroupAccess.toString());

        try {
            const idToken = await getToken(client);
            if (!idToken) {
                throw new Error("No authentication token available");
            }
            const response: SimpleAPIResponse = await uploadFileApi(formData, idToken);
            setUploadedFile(response);
            setIsUploading(false);
            setUploadedFileError(undefined);
            listUploadedFiles(idToken);
        } catch (error) {
            console.error(error);
            setIsUploading(false);
            setUploadedFileError(t("upload.uploadedFileError"));
        }
    };

    return (
        <div className={`${styles.container} ${className ?? ""}`}>
            <div>
                <Button id="calloutButton" icon={<Add24Regular />} disabled={disabled} onClick={handleButtonClick}>
                    {t("upload.manageFileUploads")}
                </Button>

                {isCalloutVisible && (
                    <Callout
                        role="dialog"
                        gapSpace={0}
                        className={styles.callout}
                        target="#calloutButton"
                        onDismiss={() => setIsCalloutVisible(false)}
                        setInitialFocus
                    >
                        <form encType="multipart/form-data">
                            <div>
                                <Label>{t("upload.fileLabel")}</Label>
                                <input
                                    accept=".txt, .md, .json, .png, .jpg, .jpeg, .bmp, .heic, .tiff, .pdf, .docx, .xlsx, .pptx, .html"
                                    className={styles.chooseFiles}
                                    type="file"
                                    onChange={handleUploadFile}
                                />
                            </div>
                            <div className={styles.checkbox}>
                                <input type="checkbox" id="groupAccess" checked={isGroupAccess} onChange={e => setIsGroupAccess(e.target.checked)} />
                                <Label htmlFor="groupAccess">Allow Group Access</Label>
                            </div>
                        </form>

                        {/* Show a loading message while files are being uploaded */}
                        {isUploading && <Text>{t("upload.uploadingFiles")}</Text>}
                        {!isUploading && uploadedFileError && <Text>{uploadedFileError}</Text>}
                        {!isUploading && uploadedFile && <Text>{uploadedFile.message}</Text>}

                        {/* Display the list of already uploaded */}
                        <h3>{t("upload.uploadedFilesLabel")}</h3>

                        {isLoading && <Text>{t("upload.loading")}</Text>}
                        {!isLoading && uploadedFiles.length === 0 && <Text>{t("upload.noFilesUploaded")}</Text>}
                        {uploadedFiles.map((filename, index) => {
                            return (
                                <div key={index} className={styles.list}>
                                    <div className={styles.item}>
                                    {filename.is_group && <span className={styles.groupTag}>G </span>}
                                    {filename.name}
                                    </div>
                                    {/* Button to remove a file from the list */}
                                    <Button
                                        icon={<Delete24Regular />}
                                        onClick={() => {
                                            const actualFilename = filename.is_group ? `[grp]_` + filename.name : filename.name;
                                            handleRemoveFile(actualFilename)
                                            }}
                                        disabled={deletionStatus[filename.name] === "pending" || deletionStatus[filename.name] === "success"}
                                    >
                                        {!deletionStatus[filename.name] && t("upload.deleteFile")}
                                        {deletionStatus[filename.name] == "pending" && t("upload.deletingFile")}
                                        {deletionStatus[filename.name] == "error" && t("upload.errorDeleting")}
                                        {deletionStatus[filename.name] == "success" && t("upload.fileDeleted")}
                                    </Button>
                                </div>
                            );
                        })}
                    </Callout>
                )}
            </div>
        </div>
    );
};
