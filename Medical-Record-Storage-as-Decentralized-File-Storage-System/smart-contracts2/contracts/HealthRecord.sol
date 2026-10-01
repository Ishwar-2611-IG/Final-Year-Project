// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HealthRecord {
    struct Record {
        string cid;
        address doctor;
        string patientId;
        string hospitalId;
        uint256 timestamp;
    }

    // Mapping of CID to Record
    mapping(string => Record) private recordsByCID;
    
    // Mapping of patientId to an array of CIDs
    mapping(string => string[]) private patientRecords;

    // Permissions: patientId => viewerAddress => bool
    // True if viewerAddress has access to patientId's records
    mapping(string => mapping(address => bool)) private accessControl;

    address public admin;

    // Events
    event RecordAdded(string indexed patientId, string cid, address indexed doctor, string hospitalId, uint256 timestamp);
    event AccessGranted(string indexed patientId, address indexed viewer);
    event AccessRevoked(string indexed patientId, address indexed viewer);

    constructor() {
        admin = msg.sender;
    }

    modifier canManageAccess(string memory patientId) {
        if (msg.sender == admin) {
            _;
            return;
        }

        bool hasAccess = accessControl[patientId][msg.sender];
        bool createdARecord = false;
        
        string[] memory cids = patientRecords[patientId];
        for(uint i = 0; i < cids.length; i++) {
            if (recordsByCID[cids[i]].doctor == msg.sender) {
                createdARecord = true;
                break;
            }
        }
        
        require(hasAccess || createdARecord, "Not authorized to grant access for this patient");
        _;
    }

    // Doctor adds a health record
    function addHealthRecord(string memory _patientId, string memory _cid, string memory _hospitalId) public {
        require(recordsByCID[_cid].timestamp == 0, "Record already exists");

        Record memory newRecord = Record({
            cid: _cid,
            doctor: msg.sender,
            patientId: _patientId,
            hospitalId: _hospitalId,
            timestamp: block.timestamp
        });

        recordsByCID[_cid] = newRecord;
        patientRecords[_patientId].push(_cid);

        emit RecordAdded(_patientId, _cid, msg.sender, _hospitalId, block.timestamp);
    }

    // Grant access to a patient's records
    function grantAccess(string memory _patientId, address _viewer) public canManageAccess(_patientId) {
        accessControl[_patientId][_viewer] = true;
        emit AccessGranted(_patientId, _viewer);
    }

    // Revoke access
    function revokeAccess(string memory _patientId, address _viewer) public canManageAccess(_patientId) {
        accessControl[_patientId][_viewer] = false;
        emit AccessRevoked(_patientId, _viewer);
    }

    // Get all records for a patient
    function getPatientRecords(string memory _patientId) public view returns (string[] memory) {
        if (msg.sender == admin) {
            return patientRecords[_patientId];
        }
        
        bool hasAccess = accessControl[_patientId][msg.sender];
        bool createdARecord = false;
        string[] memory cids = patientRecords[_patientId];
        for(uint i = 0; i < cids.length; i++) {
            if (recordsByCID[cids[i]].doctor == msg.sender) {
                createdARecord = true;
                break;
            }
        }
        
        require(hasAccess || createdARecord, "Not authorized to read");
        return patientRecords[_patientId];
    }
    
    // Get details of a single record
    function getRecordDetails(string memory _cid) public view returns (string memory patientId, address doctor, string memory hospitalId, uint256 timestamp) {
        Record memory rec = recordsByCID[_cid];
        require(rec.timestamp != 0, "Record not found");
        
        if (msg.sender != admin) {
            bool hasAccess = accessControl[rec.patientId][msg.sender];
            require(hasAccess || rec.doctor == msg.sender, "Not authorized");
        }
        
        return (rec.patientId, rec.doctor, rec.hospitalId, rec.timestamp);
    }
}
